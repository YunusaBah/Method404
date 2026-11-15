const assert = require("node:assert/strict");
const { test } = require("node:test");
const { resolveLocation, isInGambia } = require("../src/config/gambia");
const { resolveDateRange } = require("../src/services/gambia/dates");
const { slopeFromGrid } = require("../src/services/gambia/terrain");
const { FEATURED_CROPS, GAEZ_CROP_CATALOG, suitabilityClass } = require("../src/services/gambia/crops");
const { ease2GridCell } = require("../src/services/gambia/opendap");
const { SUPPORTED_PARAMETERS } = require("../src/services/nasaPowerService");
const { POWER_DEFAULT_PARAMETERS } = require("../src/services/gambia/climate");
const { createGambiaDataService } = require("../src/services/gambiaDataService");

const NOW = Date.parse("2026-11-14T12:00:00Z");
const now = () => NOW;

/** A fake fetch that answers by URL host and path, and records every call. */
function fakeFetch(routes) {
    const calls = [];
    async function fetchImpl(input, init = {}) {
        const url = new URL(input);
        calls.push({ url, init });
        for (const [match, respond] of routes) {
            if (`${url.host}${url.pathname}`.includes(match)) {
                return respond(url, init);
            }
        }
        throw new Error(`Unexpected request to ${url}`);
    }
    fetchImpl.calls = calls;
    return fetchImpl;
}

test("resolves named locations and coordinates inside The Gambia only", () => {
    assert.equal(resolveLocation({}).id, "janjanbureh");
    assert.equal(resolveLocation({ location: "BASSE" }).name, "Basse Santa Su");
    assert.deepEqual(
        resolveLocation({ latitude: "13.45", longitude: "-16.58" }),
        { id: null, name: "13.4500, -16.5800", region: null, latitude: 13.45, longitude: -16.58 }
    );
    assert.throws(() => resolveLocation({ location: "dakar" }), /location must be one of/);
    assert.throws(() => resolveLocation({ latitude: "14.69", longitude: "-17.44" }), /outside The Gambia/);
    assert.throws(() => resolveLocation({ latitude: "13.4" }), /must both be numbers/);
    assert.throws(() => resolveLocation({ location: "banjul", latitude: "13.4", longitude: "-16" }), /not both/);
    assert.equal(isInGambia(13.45, -16.58), true);
});

test("defaults date ranges to recent data and rejects invalid ranges", () => {
    assert.deepEqual(resolveDateRange({}, { now, defaultDays: 30, lagDays: 7 }),
        { start: "2026-10-09", end: "2026-11-07", days: 30 });
    assert.deepEqual(resolveDateRange({ start: "2026-01-01", end: "2026-01-31" }, { now }),
        { start: "2026-01-01", end: "2026-01-31", days: 31 });
    assert.throws(() => resolveDateRange({ start: "2026-02-30" }, { now }), /valid calendar date/);
    assert.throws(() => resolveDateRange({ start: "2026-03-01", end: "2026-02-01" }, { now }), /on or before/);
    assert.throws(() => resolveDateRange({ end: "2027-01-01" }, { now }), /future/);
    assert.throws(() => resolveDateRange({ start: "2020-01-01", end: "2026-01-01" }, { now, maxDays: 366 }), /366 days/);
});

test("computes slope from an elevation window and classifies GAEZ suitability", () => {
    assert.equal(slopeFromGrid([5, 5, 5, 5, 5, 5, 5, 5, 5], 30, 30), 0);
    // A rise of 30 m per 30 m eastwards is a 45 degree slope.
    assert.equal(slopeFromGrid([0, 30, 60, 0, 30, 60, 0, 30, 60], 30, 30), 45);
    assert.equal(suitabilityClass(90), "Very high");
    assert.equal(suitabilityClass(41), "Medium");
    assert.equal(suitabilityClass(0), "Not suitable");
    assert.equal(suitabilityClass(null), null);
});

test("pictured crops resolve only to configured GAEZ layers", () => {
    const availableLayers = new Set(GAEZ_CROP_CATALOG.map(({ crop }) => crop));
    assert.deepEqual(FEATURED_CROPS.map(({ id }) => id), [
        "rice", "cassava", "sesame", "okra", "sweet_potato", "watermelon", "fonio",
        "bissap", "mango", "cashew", "banana", "papaya", "pineapple", "citrus"
    ]);
    for (const crop of FEATURED_CROPS) {
        assert.ok(crop.gaezCrops.every((name) => availableLayers.has(name)), crop.id);
    }
});

test("returns NASA POWER data as daily rows with fill values set to null", async () => {
    assert.deepEqual(POWER_DEFAULT_PARAMETERS, SUPPORTED_PARAMETERS);
    let powerRequest;
    const service = createGambiaDataService({
        now,
        powerService: {
            async getDailyPointData(request) {
                powerRequest = request;
                return {
                    properties: { parameter: { T2M: { 20261106: 30.1, 20261107: -999 } } },
                    parameters: { T2M: { units: "C", longname: "Temperature at 2 Meters" } }
                };
            }
        }
    });

    const result = await service.getSourceData("power", { location: "banjul" });

    assert.equal(powerRequest.latitude, "13.4549");
    assert.equal(powerRequest.start, "20261009");
    assert.equal(powerRequest.end, "20261107");
    assert.deepEqual(powerRequest.parameters.split(","), SUPPORTED_PARAMETERS);
    assert.equal(result.location.id, "banjul");
    assert.equal(result.source.access, "values");
    assert.deepEqual(result.data.daily, [
        { date: "2026-11-06", T2M: 30.1 },
        { date: "2026-11-07", T2M: null }
    ]);
    assert.equal(result.data.units.T2M, "C");
});

test("returns NASA POWER soil wetness when surface and root-zone parameters are requested", async () => {
    let powerRequest;
    const service = createGambiaDataService({
        now,
        powerService: {
            async getDailyPointData(request) {
                powerRequest = request;
                return {
                    properties: {
                        parameter: {
                            GWETTOP: { 20261107: 0.18 },
                            GWETROOT: { 20261107: 0.37 }
                        }
                    },
                    parameters: {
                        GWETTOP: { units: "1", longname: "Surface soil wetness" },
                        GWETROOT: { units: "1", longname: "Root zone soil wetness" }
                    }
                };
            }
        }
    });

    const result = await service.getSourceData("power", {
        location: "basse",
        parameters: "GWETTOP,GWETROOT"
    });

    assert.deepEqual(powerRequest.parameters.split(","), ["GWETTOP", "GWETROOT"]);
    assert.deepEqual(result.data.daily, [{ date: "2026-11-07", GWETTOP: 0.18, GWETROOT: 0.37 }]);
    assert.equal(result.data.units.GWETTOP, "1");
    assert.equal(result.data.units.GWETROOT, "1");
});

test("maps ERA5 daily arrays into rows", async () => {
    const fetchImpl = fakeFetch([["archive-api.open-meteo.com", () => Response.json({
        latitude: 13.5,
        longitude: -14.75,
        daily_units: { precipitation_sum: "mm" },
        daily: { time: ["2026-11-06"], precipitation_sum: [4.1], temperature_2m_max: [33] }
    })]]);
    const service = createGambiaDataService({ now, fetchImpl });

    const result = await service.getSourceData("era5", {});

    assert.equal(fetchImpl.calls[0].url.searchParams.get("models"), "era5");
    assert.equal(fetchImpl.calls[0].url.searchParams.get("latitude"), "13.5352");
    assert.equal(result.data.daily[0].precipitation_sum, 4.1);
    assert.equal(result.data.daily[0].temperature_2m_max, 33);
    assert.equal(result.data.daily[0].soil_moisture_0_to_7cm_mean, null);
});

test("requests the latest MODIS composites and scales NDVI", async () => {
    const dates = ["A2026273", "A2026289"].map((modisDate, index) => ({
        modis_date: modisDate,
        calendar_date: ["2026-09-30", "2026-10-16"][index]
    }));
    const fetchImpl = fakeFetch([
        ["/MOD13Q1/dates", () => Response.json({ dates })],
        ["/MOD13Q1/subset", () => Response.json({
            subset: [
                { calendar_date: "2026-09-30", data: [5871] },
                { calendar_date: "2026-10-16", data: [-3000] }
            ]
        })]
    ]);
    const service = createGambiaDataService({ now, fetchImpl });

    const result = await service.getSourceData("modis", { composites: "2" });
    const subsetUrl = fetchImpl.calls[1].url;

    assert.equal(subsetUrl.searchParams.get("startDate"), "A2026273");
    assert.equal(subsetUrl.searchParams.get("endDate"), "A2026289");
    assert.deepEqual(result.data.composites, [
        { date: "2026-09-30", ndvi: 0.5871 },
        { date: "2026-10-16", ndvi: null }
    ]);
    await assert.rejects(service.getSourceData("modis", { composites: "11" }), /composites must be/);
});

test("retries a transient ORNL gateway error once", async () => {
    let subsetCalls = 0;
    const fetchImpl = fakeFetch([
        ["/VNP13A1/dates", () => Response.json({ dates: [{ modis_date: "A2024145", calendar_date: "2024-05-24" }] })],
        ["/VNP13A1/subset", () => {
            subsetCalls += 1;
            return subsetCalls === 1
                ? new Response("Bad gateway", { status: 502 })
                : Response.json({ subset: [{ calendar_date: "2024-05-24", data: [2483] }] });
        }]
    ]);
    const service = createGambiaDataService({ now, fetchImpl });

    const result = await service.getSourceData("viirs", {});

    assert.equal(subsetCalls, 2);
    assert.equal(result.data.composites[0].ndvi, 0.2483);
});

test("reads SRTM elevation and slope from a 3 x 3 window", async () => {
    const fetchImpl = fakeFetch([["api.opentopodata.org", (url) => {
        const count = url.searchParams.get("locations").split("|").length;
        return Response.json({ status: "OK", results: Array.from({ length: count }, () => ({ elevation: 6 })) });
    }]]);
    const service = createGambiaDataService({ now, fetchImpl });

    const result = await service.getSourceData("srtm", { location: "basse" });

    assert.equal(fetchImpl.calls[0].url.searchParams.get("locations").split("|").length, 9);
    assert.deepEqual(result.data, { elevationMetres: 6, slopeDegrees: 0, windowMetres: 93 });
});

test("looks up GAEZ layers and returns crops sorted by suitability", async () => {
    const fetchImpl = fakeFetch([
        ["/ImageServer/query", (url) => {
            assert.match(url.searchParams.get("where"), /sxHr_mze/);
            return Response.json({
                features: [
                    { attributes: { objectid: 1, name: "sxHr_mze", crop: "Maize" } },
                    { attributes: { objectid: 2, name: "sxHr_pml", crop: "Pearl millet" } }
                ]
            });
        }],
        ["/ImageServer/identify", (url) => {
            const id = JSON.parse(url.searchParams.get("mosaicRule")).lockRasterIds[0];
            return Response.json({ value: id === 1 ? "4100" : "7250" });
        }]
    ]);
    const service = createGambiaDataService({ now, fetchImpl });

    const result = await service.getSourceData("gaez", { input: "high" });

    assert.deepEqual(result.data.crops.slice(0, 2), [
        { crop: "Pearl millet", suitabilityIndex: 72.5, suitabilityClass: "High" },
        { crop: "Maize", suitabilityIndex: 41, suitabilityClass: "Medium" }
    ]);
    // Crops with no layer are listed last with no value.
    assert.equal(result.data.crops.at(-1).suitabilityIndex, null);
    await assert.rejects(service.getSourceData("gaez", { input: "medium" }), /input must be low or high/);
});

test("looks up one selected crop from the wider GAEZ catalogue", async () => {
    const fetchImpl = fakeFetch([
        ["/ImageServer/query", (url) => {
            assert.match(url.searchParams.get("where"), /sxLr_ban/);
            assert.doesNotMatch(url.searchParams.get("where"), /sxLr_grd/);
            return Response.json({
                features: [{ attributes: { objectid: 41, name: "sxLr_ban", crop: "Banana" } }]
            });
        }],
        ["/ImageServer/identify", () => Response.json({ value: "6850" })]
    ]);
    const service = createGambiaDataService({ now, fetchImpl });

    const result = await service.getSourceData("gaez", { location: "farafenni", crop: "Banana" });
    assert.deepEqual(result.data.crops, [
        { crop: "Banana", suitabilityIndex: 68.5, suitabilityClass: "Good" }
    ]);
    assert.equal(result.request.crop, "Banana");
    await assert.rejects(service.getSourceData("gaez", { crop: "Unlisted crop" }), /Choose a crop/);
});

test("crop predictions use NASA POWER with verified and clearly marked estimated crop profiles", async () => {
    const powerCalls = [];
    const powerService = {
        async getDailyPointData(query) {
            powerCalls.push(query);
            assert.deepEqual(query.parameters, "PRECTOTCORR,T2M_MAX,T2M_MIN");
            const rain = {};
            const tMax = {};
            const tMin = {};
            const monthlyRain = [0, 0, 0, 0, 0, 60, 220, 350, 300, 90, 0, 0];
            for (let year = 2023; year <= 2025; year += 1) {
                for (let month = 1; month <= 12; month += 1) {
                    const key = `${year}${String(month).padStart(2, "0")}01`;
                    rain[key] = monthlyRain[month - 1];
                    tMax[key] = 32;
                    tMin[key] = 22;
                }
            }
            return { properties: { parameter: { PRECTOTCORR: rain, T2M_MAX: tMax, T2M_MIN: tMin } } };
        }
    };
    const service = createGambiaDataService({ now, powerService });

    const rice = await service.getCropPrediction("rice", { location: "farafenni" });
    assert.equal(rice.available, true);
    assert.equal(rice.mode, "season-prediction");
    assert.equal(rice.source, "NASA POWER");
    assert.equal(rice.crop.name, "Rice");
    assert.ok(rice.prediction.score >= 0 && rice.prediction.score <= 100);
    assert.equal(rice.profile.confidence, "verified");
    assert.equal(rice.climate.months.length, 12);
    assert.equal(rice.climate.annualRainMm, 1020);

    const papaya = await service.getCropPrediction("papaya", { location: "farafenni" });
    assert.equal(papaya.available, true);
    assert.equal(papaya.mode, "establishment-prediction");
    assert.equal(papaya.profile.confidence, "estimated");
    assert.ok(papaya.prediction.score >= 0 && papaya.prediction.score <= 100);
    assert.equal(papaya.climate.months.length, 12);
    assert.match(papaya.notes[0], /estimated crop profile/);

    const sesame = await service.getCropPrediction("sesame", { location: "farafenni" });
    assert.equal(sesame.available, true);
    assert.equal(sesame.mode, "season-prediction");
    assert.equal(sesame.profile.confidence, "estimated");
    assert.ok(sesame.prediction.score >= 0 && sesame.prediction.score <= 100);

    for (const crop of FEATURED_CROPS.filter(({ id }) => !["rice", "papaya", "sesame"].includes(id))) {
        const result = await service.getCropPrediction(crop.id, { location: "farafenni" });
        assert.equal(result.available, true, crop.id);
        assert.ok(result.prediction.score >= 0 && result.prediction.score <= 100, crop.id);
    }

    assert.equal(powerCalls.length, FEATURED_CROPS.length);
});

test("searches Sentinel-2 and Landsat scenes around the location", async () => {
    const scene = {
        id: "S2B_TEST",
        properties: { datetime: "2026-11-09T11:22:09Z", "eo:cloud_cover": 0, platform: "sentinel-2b" },
        assets: { thumbnail: { href: "https://example.test/thumb.jpg" } },
        links: [{ rel: "self", href: "https://example.test/item" }]
    };
    const fetchImpl = fakeFetch([
        ["stac.dataspace.copernicus.eu/v1/search", () => Response.json({ features: [scene] })],
        ["landsatlook.usgs.gov/stac-server/search", () => Response.json({ numberMatched: 0, features: [] })]
    ]);
    const service = createGambiaDataService({ now, fetchImpl });

    const sentinel = await service.getSourceData("sentinel2", { maxCloud: "10" });
    const sentinelBody = JSON.parse(fetchImpl.calls[0].init.body);
    const landsat = await service.getSourceData("landsat", {});
    const landsatBody = JSON.parse(fetchImpl.calls[1].init.body);

    assert.equal(fetchImpl.calls[0].init.method, "POST");
    assert.deepEqual(sentinelBody.collections, ["sentinel-2-l2a"]);
    assert.deepEqual(sentinelBody.filter.args[1], 10);
    assert.equal(sentinelBody.datetime, "2026-09-16T00:00:00Z/2026-11-14T23:59:59Z");
    assert.deepEqual(sentinel.data.scenes[0], {
        id: "S2B_TEST",
        datetime: "2026-11-09T11:22:09Z",
        cloudCover: 0,
        platform: "sentinel-2b",
        thumbnail: "https://example.test/thumb.jpg",
        metadata: "https://example.test/item"
    });
    assert.deepEqual(landsatBody.query, { "eo:cloud_cover": { lte: 30 } });
    assert.deepEqual(landsat.data.scenes, []);
    await assert.rejects(service.getSourceData("landsat", { maxCloud: "101" }), /maxCloud must be/);
});

test("lists the latest Earthdata files for a point and prefers the main data file", async () => {
    const fetchImpl = fakeFetch([["cmr.earthdata.nasa.gov/search/granules.json", () => Response.json({
        feed: {
            entry: [{
                producer_granule_id: "ECO_TEST",
                time_start: "2026-11-10T18:12:48Z",
                time_end: "2026-11-10T18:13:40Z",
                granule_size: "34.519",
                links: [
                    { rel: "http://esipfed.org/ns/fedsearch/1.1/data#", href: "https://data.test/ECO_TEST_view_zenith.tif" },
                    { rel: "http://esipfed.org/ns/fedsearch/1.1/data#", href: "https://data.test/ECO_TEST_LST.tif" },
                    { rel: "http://esipfed.org/ns/fedsearch/1.1/data#", href: "https://search.test", inherited: true }
                ]
            }]
        }
    })]]);
    const service = createGambiaDataService({ now, fetchImpl, earthdataToken: "" });

    const latest = await service.getSourceData("ecostress", {});
    const ranged = await service.getSourceData("smap", { start: "2026-11-01", end: "2026-11-10" });

    assert.equal(fetchImpl.calls[0].url.searchParams.get("short_name"), "ECO_L2T_LSTE");
    assert.equal(fetchImpl.calls[0].url.searchParams.get("point"), "-14.7663,13.5352");
    assert.equal(fetchImpl.calls[0].url.searchParams.has("temporal"), false);
    assert.equal(fetchImpl.calls[1].url.searchParams.get("temporal"), "2026-11-01T00:00:00Z,2026-11-10T23:59:59Z");
    assert.deepEqual(latest.data.granules[0], {
        id: "ECO_TEST",
        start: "2026-11-10T18:12:48Z",
        end: "2026-11-10T18:13:40Z",
        sizeMB: 34.52,
        downloadUrl: "https://data.test/ECO_TEST_LST.tif"
    });
    assert.equal(ranged.request.shortName, "SPL3SMP_E");
});

test("summary reports each source separately and skips slow sources by default", async () => {
    const fetchImpl = fakeFetch([
        ["archive-api.open-meteo.com", () => Response.json({ daily: { time: [] } })],
        ["", () => new Response("unavailable", { status: 503 })]
    ]);
    const service = createGambiaDataService({
        now,
        fetchImpl,
        earthdataToken: "",
        powerService: { getDailyPointData: async () => ({ properties: { parameter: { T2M: {} } } }) }
    });

    const summary = await service.getSummary({ location: "kerewan" });
    const byId = Object.fromEntries(summary.results.map((result) => [result.source.id, result]));

    assert.equal(summary.location.id, "kerewan");
    assert.deepEqual(summary.skipped, ["modis", "viirs"]);
    assert.equal(byId.modis, undefined);
    assert.equal(byId.power.status, "ok");
    assert.equal(byId.era5.status, "ok");
    assert.equal(byId.srtm.status, "error");
    assert.equal(byId.srtm.error.code, "SRTM_ERROR");
    assert.equal(summary.results.length, 11);
});

test("lists sources and rejects unknown sources", async () => {
    const service = createGambiaDataService({ now, fetchImpl: fakeFetch([]), earthdataToken: "" });
    const { sources } = service.listSources();

    assert.equal(sources.length, 13);
    assert.deepEqual(sources.filter((source) => source.slow).map((source) => source.id), ["modis", "viirs"]);
    await assert.rejects(service.getSourceData("weather", {}), /Unknown data source/);
});

test("finds the SMAP EASE-Grid 2.0 cell for a location", () => {
    // Verified against the latitude and longitude stored in SMAP files:
    // cell (622, 1769) is centred at 13.5021, -14.7977.
    assert.deepEqual(ease2GridCell(13.5352, -14.7663), { row: 622, column: 1769 });
});

function cmrEntry(id, timeStart, opendapUrl) {
    return {
        producer_granule_id: id,
        time_start: timeStart,
        links: [{ rel: "http://esipfed.org/ns/fedsearch/1.1/service#", href: opendapUrl }]
    };
}

test("reads SMAP point values through OPeNDAP when an Earthdata token is set", async () => {
    const fetchImpl = fakeFetch([
        ["cmr.earthdata.nasa.gov", () => Response.json({
            feed: {
                entry: [
                    cmrEntry("SMAP_20261112_002.h5", "2026-11-12T00:00:00Z", "https://opendap.earthdata.nasa.gov/smap-12-v2"),
                    cmrEntry("SMAP_20261112_001.h5", "2026-11-12T00:00:00Z", "https://opendap.earthdata.nasa.gov/smap-12-v1"),
                    cmrEntry("SMAP_20261111_001.h5", "2026-11-11T00:00:00Z", "https://opendap.earthdata.nasa.gov/smap-11")
                ]
            }
        })],
        ["opendap.earthdata.nasa.gov/smap-12-v2", () => new Response([
            "Dataset: SMAP_20261112_002.h5",
            "/Soil_Moisture_Retrieval_Data_AM/soil_moisture[0], 0.1016, 0.0943",
            "/Soil_Moisture_Retrieval_Data_PM/soil_moisture_pm[0], -9999, -9999"
        ].join("\n"))],
        ["opendap.earthdata.nasa.gov/smap-11", () => new Response([
            "/Soil_Moisture_Retrieval_Data_AM/soil_moisture[0], -9999, -9999",
            "/Soil_Moisture_Retrieval_Data_PM/soil_moisture_pm[0], 0.0867, 0.0755"
        ].join("\n"))]
    ]);
    const service = createGambiaDataService({ now, fetchImpl, earthdataToken: "test.earthdata.token" });

    const result = await service.getSourceData("smap", {});
    const opendapCall = fetchImpl.calls.find((call) => call.url.host === "opendap.earthdata.nasa.gov");

    assert.equal(result.source.access, "values");
    assert.equal(opendapCall.init.headers.Authorization, "Bearer test.earthdata.token");
    assert.equal(opendapCall.url.pathname.endsWith(".dap.csv"), true);
    assert.match(opendapCall.url.searchParams.get("dap4.ce"), /soil_moisture\[622:622\]\[1769:1770\]/);
    // The older _001 file for 12 November is never read.
    assert.equal(fetchImpl.calls.some((call) => call.url.pathname.includes("smap-12-v1")), false);
    assert.deepEqual(result.data.series, [
        { date: "2026-11-11", soilMoistureAm: null, soilMoisturePm: 0.087 },
        { date: "2026-11-12", soilMoistureAm: 0.102, soilMoisturePm: null }
    ]);
    assert.equal(result.request.start, "2026-10-31");
    assert.equal(result.request.end, "2026-11-13");
});

test("converts GLDAS units and reports a refused token clearly", async () => {
    let refuse = false;
    const fetchImpl = fakeFetch([
        ["cmr.earthdata.nasa.gov", () => Response.json({
            feed: { entry: [cmrEntry("GLDAS_A20260731.2100", "2026-07-31T21:00:00Z", "https://opendap.earthdata.nasa.gov/gldas")] }
        })],
        ["opendap.earthdata.nasa.gov/gldas", () => refuse
            ? new Response("EULA", { status: 403 })
            : new Response([
                "/SoilMoi0_10cm_inst[0][0], 31.3564, 26.0672",
                "/RootMoist_inst[0][0], 320.379, 305.284",
                "/Rainf_f_tavg[0][0], 0.0001, 0",
                "/Evap_tavg[0][0], 0.00005, 0",
                "/Tair_f_inst[0][0], 300.15, 299"
            ].join("\n"))]
    ]);
    const service = createGambiaDataService({ now, fetchImpl, earthdataToken: "test.earthdata.token" });

    const result = await service.getSourceData("gldas", { location: "basse" });

    assert.deepEqual(result.data.series[0], {
        time: "2026-07-31T21:00:00Z",
        soilMoisture0To10cm: 0.314,
        rootZoneMoisture: 320.4,
        rainfallRate: 0.36,
        evapotranspirationRate: 0.18,
        airTemperature: 27
    });

    refuse = true;
    const refusingService = createGambiaDataService({ now, fetchImpl, earthdataToken: "test.earthdata.token" });
    await assert.rejects(refusingService.getSourceData("gldas", {}), /refused the token/);
});
