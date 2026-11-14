const { ApiError } = require("../middleware/apiError");
const { GAMBIA_BOUNDS, GAMBIA_LOCATIONS, DEFAULT_LOCATION_ID, resolveLocation } = require("../config/gambia");
const { createEra5Source, createPowerSource } = require("./gambia/climate");
const { createGaezSource } = require("./gambia/crops");
const { createEarthdataSource } = require("./gambia/earthdata");
const { createImagerySource } = require("./gambia/imagery");
const { createSrtmSource } = require("./gambia/terrain");
const { createVegetationSource } = require("./gambia/vegetation");

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

    return { getRegion, getSourceData, getSummary, listSources };
}

const gambiaDataService = createGambiaDataService();

module.exports = { createGambiaDataService, gambiaDataService };
