const { ApiError } = require("../middleware/apiError");
const { GAMBIA_BOUNDS, GAMBIA_LOCATIONS, DEFAULT_LOCATION_ID, resolveLocation } = require("../config/gambia");
const { createEra5Source, createPowerSource } = require("./gambia/climate");
const { createGaezSource } = require("./gambia/crops");
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

        // Soil moisture: SMAP measures it directly; NASA POWER's surface
        // wetness index is the fallback.
        let soil = null;
        const smapLatest = smap?.data.series ? latestNumber(smap.data.series, ["soilMoistureAm", "soilMoisturePm"]) : null;
        const powerLatest = power?.data.daily ? latestNumber(power.data.daily, ["GWETTOP"]) : null;
        if (smapLatest) {
            soil = { source: byId.get("smap").name, date: smapLatest.row.date, value: Number(smapLatest.value.toFixed(3)), unit: "m³/m³" };
        } else if (powerLatest) {
            soil = { source: byId.get("power").name, date: powerLatest.row.date, value: powerLatest.value, unit: "wetness index (0-1)" };
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

    return { getRecommendations, getRegion, getSourceData, getSummary, listSources };
}

const gambiaDataService = createGambiaDataService();

module.exports = { createGambiaDataService, gambiaDataService };
