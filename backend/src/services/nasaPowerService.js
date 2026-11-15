const { config } = require("../config");
const { ApiError } = require("../middleware/apiError");

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const DEFAULT_TIMEOUT_MS = 15_000;
const SOURCE = "NASA POWER Daily API";
const SUPPORTED_PARAMETERS = Object.freeze([
    "PRECTOTCORR",
    "T2M",
    "T2M_MAX",
    "T2M_MIN",
    "RH2M",
    "ALLSKY_SFC_SW_DWN"
]);
// Accepted when requested explicitly, but not part of the default set:
// surface and root-zone soil wetness (0-1), used by the /api/gambia sources.
const OPTIONAL_PARAMETERS = Object.freeze(["GWETTOP", "GWETROOT"]);
const ACCEPTED_PARAMETERS = Object.freeze([...SUPPORTED_PARAMETERS, ...OPTIONAL_PARAMETERS]);

function isValidDate(value) {
    if (typeof value !== "string" || !/^\d{8}$/.test(value)) {
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
    if (!["string", "number"].includes(typeof latitude)) {
        throw new ApiError(400, "INVALID_LATITUDE", "latitude must be a number between -90 and 90.");
    }
    if (!["string", "number"].includes(typeof longitude)) {
        throw new ApiError(400, "INVALID_LONGITUDE", "longitude must be a number between -180 and 180.");
    }
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    if (latitude === undefined || String(latitude).trim() === "" ||
        !Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90) {
        throw new ApiError(400, "INVALID_LATITUDE", "latitude must be a number between -90 and 90.");
    }
    if (longitude === undefined || String(longitude).trim() === "" ||
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

    const parameterList = parameters === undefined || parameters === ""
        ? [...SUPPORTED_PARAMETERS]
        : typeof parameters === "string"
            ? parameters.split(",").map((parameter) => parameter.trim().toUpperCase())
            : [];
    if (
        parameterList.length < 1 ||
        parameterList.length > ACCEPTED_PARAMETERS.length ||
        parameterList.some((parameter) => !ACCEPTED_PARAMETERS.includes(parameter)) ||
        new Set(parameterList).size !== parameterList.length
    ) {
        throw new ApiError(
            400,
            "INVALID_PARAMETERS",
            `parameters must be a comma-separated list of supported NASA POWER parameters: ${ACCEPTED_PARAMETERS.join(", ")}.`
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
            if (error?.name === "TimeoutError" || error?.name === "AbortError") {
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

        if (
            !payload ||
            typeof payload !== "object" ||
            !payload.properties?.parameter ||
            typeof payload.properties.parameter !== "object"
        ) {
            throw new ApiError(502, "NASA_POWER_INVALID_RESPONSE", "NASA POWER returned an unexpected response.");
        }

        return payload;
    }

    function buildUrl(query) {
        const request = validateRequest(query);
        const url = new URL(baseUrl);
        url.searchParams.set("latitude", String(request.latitude));
        url.searchParams.set("longitude", String(request.longitude));
        url.searchParams.set("start", request.start);
        url.searchParams.set("end", request.end);
        url.searchParams.set("community", request.community);
        url.searchParams.set("parameters", request.parameters.join(","));
        url.searchParams.set("format", "JSON");
        return { request, url };
    }

    async function getDailyPointData(query) {
        const { url } = buildUrl(query);
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

    async function getObservations(query) {
        const request = validateRequest(query);
        const payload = await getDailyPointData({
            ...request,
            parameters: request.parameters.join(",")
        });
        const parameterMetadata = payload.parameters || {};
        const observations = [];
        const dates = new Set();

        for (const [parameter, values] of Object.entries(payload.properties.parameter)) {
            if (!values || typeof values !== "object" || Array.isArray(values)) {
                continue;
            }
            const metadata = parameterMetadata[parameter] || {};
            for (const [date, rawValue] of Object.entries(values)) {
                if (!isValidDate(date)) {
                    continue;
                }
                dates.add(date);
                const numericValue = Number(rawValue);
                const missing = rawValue === null ||
                    rawValue === undefined ||
                    rawValue === "" ||
                    !Number.isFinite(numericValue) ||
                    numericValue === -999;
                observations.push({
                    date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
                    parameter,
                    value: missing ? null : numericValue,
                    unit: metadata.units || null,
                    missing,
                    missingValue: missing ? rawValue : undefined
                });
            }
        }

        observations.sort((left, right) =>
            left.date.localeCompare(right.date) || left.parameter.localeCompare(right.parameter)
        );

        return {
            source: SOURCE,
            attribution: "NASA Langley Research Center POWER Project",
            request: {
                latitude: request.latitude,
                longitude: request.longitude,
                start: request.start,
                end: request.end,
                community: request.community,
                parameters: request.parameters
            },
            metadata: {
                header: payload.header || null,
                messages: payload.messages || [],
                parameters: Object.fromEntries(
                    request.parameters.map((parameter) => [
                        parameter,
                        parameterMetadata[parameter] || null
                    ])
                ),
                returnedDateCount: dates.size
            },
            observations
        };
    }

    async function getSummary(query) {
        const data = await getObservations(query);
        const series = Object.fromEntries(SUPPORTED_PARAMETERS.map((parameter) => [
            parameter,
            data.observations.filter((observation) =>
                observation.parameter === parameter && !observation.missing
            )
        ]));
        const values = (parameter) => series[parameter].map((observation) => observation.value);
        const mean = (items) => items.length
            ? items.reduce((total, value) => total + value, 0) / items.length
            : null;
        const rounded = (value) => value === null ? null : Number(value.toFixed(2));
        const extreme = (items, operation) => items.length
            ? items.reduce((result, value) => operation(result, value))
            : null;

        return {
            source: data.source,
            attribution: data.attribution,
            request: data.request,
            metadata: data.metadata,
            summaries: {
                averageTemperature: {
                    value: rounded(mean(values("T2M"))),
                    unit: data.metadata.parameters.T2M?.units || null,
                    derivedFrom: "T2M",
                    aggregation: "arithmetic mean of available daily observations"
                },
                maximumTemperature: {
                    value: rounded(extreme(values("T2M_MAX"), Math.max)),
                    unit: data.metadata.parameters.T2M_MAX?.units || null,
                    derivedFrom: "T2M_MAX",
                    aggregation: "maximum of available daily maximum-temperature observations"
                },
                minimumTemperature: {
                    value: rounded(extreme(values("T2M_MIN"), Math.min)),
                    unit: data.metadata.parameters.T2M_MIN?.units || null,
                    derivedFrom: "T2M_MIN",
                    aggregation: "minimum of available daily minimum-temperature observations"
                },
                totalPrecipitation: {
                    value: rounded(values("PRECTOTCORR").length
                        ? values("PRECTOTCORR").reduce((total, value) => total + value, 0)
                        : null),
                    unit: data.metadata.parameters.PRECTOTCORR?.units === "mm/day"
                        ? "mm"
                        : data.metadata.parameters.PRECTOTCORR?.units || null,
                    derivedFrom: "PRECTOTCORR",
                    aggregation: "sum of available daily precipitation observations"
                },
                averageRelativeHumidity: {
                    value: rounded(mean(values("RH2M"))),
                    unit: data.metadata.parameters.RH2M?.units || null,
                    derivedFrom: "RH2M",
                    aggregation: "arithmetic mean of available daily observations"
                },
                averageSolarRadiation: {
                    value: rounded(mean(values("ALLSKY_SFC_SW_DWN"))),
                    unit: data.metadata.parameters.ALLSKY_SFC_SW_DWN?.units || null,
                    derivedFrom: "ALLSKY_SFC_SW_DWN",
                    aggregation: "arithmetic mean of available daily observations"
                }
            },
            observations: data.observations
        };
    }

    return { getDailyPointData, getObservations, getSummary };
}

const nasaPowerService = createNasaPowerService();

module.exports = {
    createNasaPowerService,
    nasaPowerService,
    SUPPORTED_PARAMETERS,
    validateRequest
};
