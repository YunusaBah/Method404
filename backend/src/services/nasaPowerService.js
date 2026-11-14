const { config } = require("../config");
const { ApiError } = require("../middleware/apiError");

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const DEFAULT_TIMEOUT_MS = 15_000;

function isValidDate(value) {
    if (!/^\d{8}$/.test(value)) {
        return false;
    }

    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6));
    const day = Number(value.slice(6, 8));
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;
}

function validateRequest({ latitude, longitude, start, end, parameters, community = "AG" }) {
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    if (latitude === undefined || latitude === "" ||
        !Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90) {
        throw new ApiError(400, "INVALID_LATITUDE", "latitude must be a number between -90 and 90.");
    }
    if (longitude === undefined || longitude === "" ||
        !Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180) {
        throw new ApiError(400, "INVALID_LONGITUDE", "longitude must be a number between -180 and 180.");
    }
    if (typeof start !== "string" || !isValidDate(start)) {
        throw new ApiError(400, "INVALID_START_DATE", "start must be a valid date in YYYYMMDD format.");
    }
    if (typeof end !== "string" || !isValidDate(end)) {
        throw new ApiError(400, "INVALID_END_DATE", "end must be a valid date in YYYYMMDD format.");
    }
    if (start > end) {
        throw new ApiError(400, "INVALID_DATE_RANGE", "start must be on or before end.");
    }

    const parameterList = typeof parameters === "string"
        ? parameters.split(",").map((parameter) => parameter.trim().toUpperCase())
        : [];
    if (
        parameterList.length < 1 ||
        parameterList.length > 20 ||
        parameterList.some((parameter) => !/^[A-Z][A-Z0-9_]{0,31}$/.test(parameter)) ||
        new Set(parameterList).size !== parameterList.length
    ) {
        throw new ApiError(
            400,
            "INVALID_PARAMETERS",
            "parameters must be a comma-separated list of 1 to 20 unique NASA POWER parameter names."
        );
    }
    if (typeof community !== "string" || !["AG", "RE"].includes(community)) {
        throw new ApiError(400, "INVALID_COMMUNITY", "community must be AG or RE.");
    }

    return {
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        start,
        end,
        parameters: parameterList,
        community
    };
}

function createNasaPowerService({
    baseUrl = config.nasaPowerBaseUrl,
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    now = Date.now
} = {}) {
    const cache = new Map();
    const inFlight = new Map();

    async function requestData(url) {
        let response;
        try {
            response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
        } catch (error) {
            if (error.name === "TimeoutError" || error.name === "AbortError") {
                throw new ApiError(504, "NASA_POWER_TIMEOUT", "NASA POWER did not respond before the request timed out.");
            }
            throw new ApiError(502, "NASA_POWER_UNAVAILABLE", "NASA POWER could not be reached.");
        }

        if (!response.ok) {
            throw new ApiError(502, "NASA_POWER_ERROR", `NASA POWER returned HTTP ${response.status}.`);
        }

        let payload;
        try {
            payload = await response.json();
        } catch {
            throw new ApiError(502, "NASA_POWER_INVALID_RESPONSE", "NASA POWER returned an invalid response.");
        }

        if (!payload || typeof payload !== "object" || !payload.properties?.parameter) {
            throw new ApiError(502, "NASA_POWER_INVALID_RESPONSE", "NASA POWER returned an unexpected response.");
        }

        return payload;
    }

    async function getDailyPointData(query) {
        const request = validateRequest(query);
        const url = new URL(baseUrl);
        url.searchParams.set("latitude", String(request.latitude));
        url.searchParams.set("longitude", String(request.longitude));
        url.searchParams.set("start", request.start);
        url.searchParams.set("end", request.end);
        url.searchParams.set("community", request.community);
        url.searchParams.set("parameters", request.parameters.join(","));
        url.searchParams.set("format", "JSON");
        const cacheKey = url.toString();
        const cached = cache.get(cacheKey);

        if (cached && cached.expiresAt > now()) {
            return cached.payload;
        }
        if (cached) {
            cache.delete(cacheKey);
        }
        if (inFlight.has(cacheKey)) {
            return inFlight.get(cacheKey);
        }

        const pending = requestData(cacheKey).then((payload) => {
            cache.set(cacheKey, { payload, expiresAt: now() + CACHE_TTL_MS });
            if (cache.size > MAX_CACHE_ENTRIES) {
                cache.delete(cache.keys().next().value);
            }
            return payload;
        });
        inFlight.set(cacheKey, pending);

        try {
            return await pending;
        } finally {
            inFlight.delete(cacheKey);
        }
    }

    return { getDailyPointData };
}

const nasaPowerService = createNasaPowerService();

module.exports = { createNasaPowerService, nasaPowerService, validateRequest };
