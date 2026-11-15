const { ApiError } = require("../middleware/apiError");
const { GAMBIA_BOUNDS, GAMBIA_LOCATIONS, DEFAULT_LOCATION_ID, resolveLocation } = require("../config/gambia");
const { createEra5Source, createPowerClimatology, createPowerSource } = require("./gambia/climate");
const { CROP_CALENDAR } = require("./gambia/cropCalendar");
const { buildRotationPlan } = require("./gambia/rotation");
const engine = require("./gambia/engine");
const { createCache } = require("./external/http");
const { createNasaPowerService } = require("./nasaPowerService");
const { PREDICTION_CROPS } = require("../data/crops");
const { createRecommendService } = require("./recommendService");
const {
    FEATURED_CROP_BY_ID,
    FEATURED_CROPS,
    GAEZ_CROP_CATALOG,
    GAMBIA_CROPS,
    createGaezSource
} = require("./gambia/crops");
const { createEarthdataSource } = require("./gambia/earthdata");
const { createImagerySource } = require("./gambia/imagery");
const { createSrtmSource } = require("./gambia/terrain");
const { createVegetationSource } = require("./gambia/vegetation");
const { buildRecommendations } = require("./gambia/recommendations");

// Sources that answer slowly (the ORNL MODIS/VIIRS service can take a minute)
// are left out of the summary unless requested.
const SLOW_SOURCES = new Set(["modis", "viirs"]);

const SOURCE_NOT_CONNECTED = Object.freeze([
    Object.freeze({
        name: "Local soil and crop data for The Gambia",
        reason: "Not in the challenge resources. Needs verified national or local sources."
    })
]);

function describe(source) {
    const { id, name, provider, category, access, measures, link } = source;
    return { id, name, provider, category, access, measures, link, slow: SLOW_SOURCES.has(id) };
}

function createGambiaDataService(deps = {}) {
    const sources = [
        createPowerSource(deps),
        createEra5Source(deps),
        createVegetationSource("modis", deps),
        createVegetationSource("viirs", deps),
        createSrtmSource(deps),
        createGaezSource(deps),
        createImagerySource("sentinel2", deps),
        createImagerySource("landsat", deps),
        createEarthdataSource("smap", deps),
        createEarthdataSource("gpm-imerg", deps),
        createEarthdataSource("ecostress", deps),
        createEarthdataSource("gldas", deps),
        createEarthdataSource("grace-fo", deps)
    ];
    const byId = new Map(sources.map((source) => [source.id, source]));
    const now = deps.now || Date.now;
    const getClimateNormals = createPowerClimatology(deps);
    const enginePower = deps.powerService || createNasaPowerService({ fetchImpl: deps.fetchImpl, now: deps.now });
    const powerRecommendations = createRecommendService({ powerService: enginePower, now });
    const recordCache = createCache({ ttlMs: 24 * 60 * 60 * 1000, now: deps.now });

    function getRegion() {
        return {
            country: "The Gambia",
            bounds: GAMBIA_BOUNDS,
            defaultLocation: DEFAULT_LOCATION_ID,
            locations: GAMBIA_LOCATIONS
        };
    }

    function listSources() {
        return { sources: sources.map(describe), notConnected: SOURCE_NOT_CONNECTED };
    }

    function listCrops() {
        const recommended = new Set(GAMBIA_CROPS.map(({ crop }) => crop));
        const predictionReady = PREDICTION_CROPS;
        return {
            crops: GAEZ_CROP_CATALOG.map(({ crop }) => ({
                crop,
                recommended: recommended.has(crop)
            })),
            featuredCrops: FEATURED_CROPS.map(({ id, crop, gaezCrops }) => ({
                id,
                crop,
                suitabilityAvailable: gaezCrops.length > 0,
                predictionAvailable: predictionReady.has(id),
                predictionType: predictionReady.get(id)?.type || "season",
                profileConfidence: predictionReady.get(id)?.confidence || null
            }))
        };
    }

    async function getSourceData(sourceId, query = {}) {
        const source = byId.get(sourceId);
        if (!source) {
            throw new ApiError(404, "UNKNOWN_SOURCE", `Unknown data source. Use one of: ${[...byId.keys()].join(", ")}.`);
        }
        const { location: locationId, latitude, longitude, ...options } = query;
        const location = resolveLocation({ location: locationId, latitude, longitude });
        const result = await source.fetch({ location, query: options });

        return {
            success: true,
            source: describe(source),
            location,
            retrievedAt: new Date(now()).toISOString(),
            ...result
        };
    }

    async function getCropPrediction(cropId, query = {}) {
        const crop = FEATURED_CROP_BY_ID.get(String(cropId).toLowerCase());
        if (!crop) {
            throw new ApiError(404, "UNKNOWN_CROP", "Choose a crop from the featured crop list.");
        }

        const { location: locationId, latitude, longitude } = query;
        const location = resolveLocation({ location: locationId, latitude, longitude });
        const result = await powerRecommendations.getCropPrediction(crop.id, {
            lat: location.latitude,
            lon: location.longitude,
            district: location.name
        });
        const available = result.prediction !== null;
        return {
            success: true,
            available,
            mode: available
                ? `${result.profile.type}-prediction`
                : "climate-diagnostics",
            crop: { id: crop.id, name: crop.crop },
            location,
            source: result.source,
            period: result.period,
            climate: result.climate,
            profile: result.profile,
            prediction: result.prediction,
            notes: [
                available
                    ? result.profile.confidence === "verified"
                        ? "Prediction compares NASA POWER climate data with reviewed crop requirements."
                        : "Indicative score compares NASA POWER climate data with an estimated crop profile that has not been locally validated."
                    : "No crop profile is available, so only NASA POWER climate diagnostics are provided.",
                "NASA POWER is a gridded climate estimate, not a field measurement or a yield forecast. Local soil, irrigation, variety and farm management are not represented."
            ]
        };
    }

    /** Fetches every source for one location; one failing source does not fail the rest. */
    async function getSummary(query = {}) {
        const { location: locationId, latitude, longitude, include } = query;
        const location = resolveLocation({ location: locationId, latitude, longitude });
        if (include !== undefined && include !== "all") {
            throw new ApiError(400, "INVALID_INCLUDE", "include must be all when provided.");
        }
        const selected = sources.filter((source) => include === "all" || !SLOW_SOURCES.has(source.id));
        const settled = await Promise.allSettled(selected.map((source) => source.fetch({ location, query: {} })));

        return {
            success: true,
            location,
            retrievedAt: new Date(now()).toISOString(),
            skipped: include === "all" ? [] : [...SLOW_SOURCES],
            results: selected.map((source, index) => {
                const outcome = settled[index];
                if (outcome.status === "fulfilled") {
                    return { source: describe(source), status: "ok", ...outcome.value };
                }
                const error = outcome.reason instanceof ApiError
                    ? { code: outcome.reason.code, message: outcome.reason.message }
                    : { code: "INTERNAL_SERVER_ERROR", message: "An unexpected server error occurred." };
                if (!(outcome.reason instanceof ApiError)) {
                    console.error(outcome.reason);
                }
                return { source: describe(source), status: "error", error };
            })
        };
    }

    function settledError(outcome) {
        if (outcome.reason instanceof ApiError) {
            return { code: outcome.reason.code, message: outcome.reason.message };
        }
        console.error(outcome.reason);
        return { code: "INTERNAL_SERVER_ERROR", message: "An unexpected server error occurred." };
    }

    function latestNumber(series, keys) {
        for (let index = series.length - 1; index >= 0; index -= 1) {
            const values = keys.map((key) => series[index][key]).filter((value) => typeof value === "number");
            if (values.length) {
                return { row: series[index], value: values.reduce((a, b) => a + b, 0) / values.length };
            }
        }
        return null;
    }

    /**
     * Ranks crops for a location from FAO GAEZ suitability, the season, the
     * onset of the rains and current soil moisture. GAEZ is required; the
     * other inputs are used when available.
     */
    async function getRecommendations(query = {}) {
        const { location: locationId, latitude, longitude, input = "low" } = query;
        const location = resolveLocation({ location: locationId, latitude, longitude });
        const wanted = {
            gaez: { input },
            "gpm-imerg": {},
            smap: {},
            power: {},
            era5: {}
        };
        const ids = Object.keys(wanted);
        const settled = await Promise.allSettled(ids.map((id) => byId.get(id).fetch({ location, query: wanted[id] })));
        const results = Object.fromEntries(ids.map((id, index) => [id, settled[index]]));

        if (results.gaez.status === "rejected") {
            throw results.gaez.reason;
        }
        const value = (id) => results[id].status === "fulfilled" ? results[id].value : null;
        const gpm = value("gpm-imerg");
        const smap = value("smap");
        const power = value("power");
        const era5 = value("era5");

        // Daily rainfall: GPM is the most recent (about 2 days behind);
        // NASA POWER is the fallback (about a week behind).
        let rainfall = null;
        if (gpm?.data.series?.some((row) => row.precipitationMm !== null)) {
            rainfall = {
                source: byId.get("gpm-imerg").name,
                daily: gpm.data.series.map((row) => ({ date: row.date, rainMm: row.precipitationMm }))
            };
        } else if (power?.data.daily?.length) {
            rainfall = {
                source: byId.get("power").name,
                daily: power.data.daily.map((row) => ({ date: row.date, rainMm: row.PRECTOTCORR ?? null }))
            };
        }

        // Prefer SMAP soil moisture; use ERA5 topsoil moisture when available.
        let soil = null;
        const smapLatest = smap?.data.series ? latestNumber(smap.data.series, ["soilMoistureAm", "soilMoisturePm"]) : null;
        const era5Latest = era5?.data.daily
            ? latestNumber(era5.data.daily, ["soil_moisture_0_to_7cm_mean", "soil_moisture_7_to_28cm_mean"])
            : null;
        if (smapLatest) {
            soil = { source: byId.get("smap").name, date: smapLatest.row.date, value: Number(smapLatest.value.toFixed(3)), unit: "m³/m³" };
        } else if (era5Latest) {
            soil = { source: byId.get("era5").name, date: era5Latest.row.date, value: Number(era5Latest.value.toFixed(3)), unit: "m³/m³" };
        }

        // Water balance from one dataset, so rainfall and demand match.
        let waterBalance = null;
        if (era5?.data.daily?.length) {
            const rows = era5.data.daily;
            const rainMm = rows.reduce((sum, row) => sum + (row.precipitation_sum ?? 0), 0);
            const et0Mm = rows.reduce((sum, row) => sum + (row.et0_fao_evapotranspiration ?? 0), 0);
            waterBalance = {
                source: byId.get("era5").name,
                start: rows[0].date,
                end: rows.at(-1).date,
                rainfallMm: Number(rainMm.toFixed(1)),
                referenceEvapotranspirationMm: Number(et0Mm.toFixed(1)),
                percentOfDemandMet: et0Mm > 0 ? Math.round((rainMm / et0Mm) * 100) : null
            };
        }

        const month = new Date(now()).getUTCMonth() + 1;
        const recommendations = buildRecommendations({
            month,
            gaezCrops: value("gaez").data.crops,
            input: value("gaez").request.input,
            rainfall,
            soil,
            waterBalance
        });

        return {
            success: true,
            location,
            retrievedAt: new Date(now()).toISOString(),
            request: { input: value("gaez").request.input },
            ...recommendations,
            sources: ids.map((id) => ({
                id,
                name: byId.get(id).name,
                status: results[id].status === "fulfilled" ? "ok" : "error",
                ...(results[id].status === "rejected" ? { error: settledError(results[id]) } : {})
            })),
            notes: [
                "This is decision support, not field advice. It combines long-term suitability with current conditions using simple published rules.",
                "Onset of the rains uses the Sivakumar (1988) rule: 20 mm within 3 days, with no dry spell over 7 days afterwards.",
                "Sowing months and water needs are general regional guidance (FAO). Confirm timing and varieties with local extension services."
            ]
        };
    }

    /**
     * Plans a multi-year crop rotation for an upland field from FAO GAEZ
     * suitability and the NASA POWER long-term growing period.
     */
    async function getRotationPlan(query = {}) {
        const {
            location: locationId, latitude, longitude, input = "low", years = "3", irrigation = "false", previous
        } = query;
        const location = resolveLocation({ location: locationId, latitude, longitude });

        const yearCount = Number(years);
        if (!Number.isInteger(yearCount) || yearCount < 2 || yearCount > 5) {
            throw new ApiError(400, "INVALID_YEARS", "years must be an integer from 2 to 5.");
        }
        if (!["true", "false"].includes(String(irrigation))) {
            throw new ApiError(400, "INVALID_IRRIGATION", "irrigation must be true or false.");
        }
        const rainfedCrops = Object.keys(CROP_CALENDAR).filter((crop) => CROP_CALENDAR[crop].system === "rainfed");
        let previousCrop = null;
        if (previous !== undefined && previous !== "" && String(previous).toLowerCase() !== "none") {
            previousCrop = rainfedCrops.find((crop) => crop.toLowerCase() === String(previous).toLowerCase()) ?? null;
            if (!previousCrop) {
                throw new ApiError(400, "INVALID_PREVIOUS_CROP", `previous must be none or one of: ${rainfedCrops.join(", ")}.`);
            }
        }

        const [gaez, normals] = await Promise.allSettled([
            byId.get("gaez").fetch({ location, query: { input } }),
            getClimateNormals(location)
        ]);
        if (gaez.status === "rejected") {
            throw gaez.reason;
        }

        const plan = buildRotationPlan({
            gaezCrops: gaez.value.data.crops,
            normals: normals.status === "fulfilled" ? normals.value : null,
            years: yearCount,
            irrigation: String(irrigation) === "true",
            previousCrop,
            now: now()
        });

        return {
            success: true,
            location,
            retrievedAt: new Date(now()).toISOString(),
            request: { input: gaez.value.request.input, years: yearCount, irrigation: String(irrigation) === "true", previous: previousCrop },
            ...plan,
            sources: [
                { id: "gaez", name: byId.get("gaez").name, status: "ok" },
                {
                    id: "power-climatology",
                    name: "NASA POWER climatology",
                    status: normals.status === "fulfilled" ? "ok" : "error",
                    ...(normals.status === "rejected" ? { error: settledError(normals) } : {})
                }
            ],
            notes: [
                "Plans are for upland fields. Lowland swamp rice is usually grown continuously and is not planned here.",
                "The growing period follows the FAO method: days when average rainfall is at least half of potential evapotranspiration, plus about 100 mm of stored soil water. Potential evapotranspiration is estimated with the Hargreaves equation from NASA POWER climate normals.",
                "Crop choice starts from FAO GAEZ suitability, then favours a legume after a cereal and a different family each season. These are general agronomic rules; adapt them to your soil, market and labour."
            ]
        };
    }

    /**
     * The last ten complete rainy seasons of NASA POWER daily rainfall and
     * maximum temperature for a district, plus its FAO GAEZ suitability.
     */
    async function getEngineRecord(district) {
        const today = new Date(now());
        // A season is complete once October is over.
        const lastSeasonYear = today.getUTCMonth() >= 10 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
        const firstYear = lastSeasonYear - 9;
        const endDate = new Date(Math.min(Date.UTC(lastSeasonYear, 11, 31), today.getTime() - 3 * 86400000));
        const compact = (date) => date.toISOString().slice(0, 10).replaceAll("-", "");

        return recordCache(`${district.id}|${lastSeasonYear}`, async () => {
            const [power, gaez] = await Promise.all([
                enginePower.getDailyPointData({
                    latitude: String(district.latitude),
                    longitude: String(district.longitude),
                    start: `${firstYear}0501`,
                    end: compact(endDate),
                    parameters: "PRECTOTCORR,T2M_MAX",
                    community: "AG"
                }),
                byId.get("gaez").fetch({ location: district, query: { input: "low" } })
                    .catch((error) => {
                        console.error(`[engine] GAEZ unavailable for ${district.id}: ${error.message}`);
                        return null;
                    })
            ]);
            const rain = power.properties.parameter.PRECTOTCORR || {};
            const heat = power.properties.parameter.T2M_MAX || {};
            const clean = (value) => (typeof value === "number" && value !== -999 ? value : null);
            const daily = Object.keys(rain).sort().map((key) => ({
                date: `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`,
                rainMm: clean(rain[key]),
                tMaxC: clean(heat[key])
            }));
            return {
                seasons: engine.seasonsFromDaily(daily, lastSeasonYear),
                gaezCrops: gaez?.data.crops ?? []
            };
        });
    }

    function engineDistricts() {
        return engine.DISTRICTS.map(({ id, name, defaultSoil, latitude, longitude }) => ({
            id, name, defaultSoil, latitude, longitude
        }));
    }

    async function engineInput(body = {}) {
        const checked = engine.validateProfile(body.profile);
        if (checked.missing) {
            return { insufficient: { status: "insufficient", missing: checked.missing } };
        }
        const scenario = engine.validateScenario(body.scenario);
        const fixed = engine.validateFixed(body.fixed, checked.profile.seasons);
        const record = await getEngineRecord(checked.district);
        if (record.seasons.length === 0) {
            throw new ApiError(502, "POWER_INVALID_RESPONSE", "NASA POWER returned no complete rainy seasons for this district.");
        }
        return { input: { record, gaezCrops: record.gaezCrops, profile: checked.profile, scenario, fixed } };
    }

    async function enginePlan(body) {
        const { insufficient, input } = await engineInput(body);
        return insufficient ?? engine.planFromRecord(input).plan;
    }

    async function engineSlotOptions(body = {}) {
        const { insufficient, input } = await engineInput(body);
        if (insufficient) return [];
        const slot = Number(body.slot);
        if (!Number.isInteger(slot) || slot < 0 || slot >= input.profile.seasons) {
            throw new ApiError(400, "INVALID_SLOT", `slot must be an integer from 0 to ${input.profile.seasons - 1}.`);
        }
        return engine.slotOptionsFromRecord(input, slot);
    }

    return {
        enginePlan,
        engineSlotOptions,
        engineDistricts,
        getRecommendations,
        getCropPrediction,
        getRegion,
        getRotationPlan,
        getSourceData,
        getSummary,
        listCrops,
        listSources
    };
}

const gambiaDataService = createGambiaDataService();

module.exports = { createGambiaDataService, gambiaDataService };
