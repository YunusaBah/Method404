const { ApiError } = require("../../middleware/apiError");
const { createCache, fetchJson } = require("../external/http");

const ORNL_BASE_URL = "https://modis.ornl.gov/rst/api/v1";
// The ORNL service accepts at most 10 composite dates per subset request.
const MAX_COMPOSITES = 10;
const DEFAULT_COMPOSITES = 6;
// The ORNL service can take close to a minute to answer.
const ORNL_TIMEOUT_MS = 120_000;

const PRODUCTS = {
    modis: {
        product: "MOD13Q1",
        band: "250m_16_days_NDVI",
        fillValue: -3000,
        resolution: "250 m",
        name: "MODIS vegetation index (MOD13Q1)",
        link: "https://lpdaac.usgs.gov/products/mod13q1v061/"
    },
    viirs: {
        product: "VNP13A1",
        band: "500_m_16_days_NDVI",
        fillValue: -15000,
        resolution: "500 m",
        name: "VIIRS vegetation index (VNP13A1)",
        link: "https://lpdaac.usgs.gov/products/vnp13a1v002/"
    }
};
const SCALE_FACTOR = 0.0001;
// The ORNL service returns HTTP 503 when it is busy, so retry and never send
// it more than one request at a time from this process.
const ORNL_RETRIES = 2;
let ornlQueue = Promise.resolve();

function queueOrnlRequest(task) {
    const run = ornlQueue.then(task, task);
    ornlQueue = run.catch(() => {});
    return run;
}

function createVegetationSource(kind, { fetchImpl, now } = {}) {
    const spec = PRODUCTS[kind];
    const label = `The NASA ORNL ${spec.product} service`;
    const source = kind;
    const datesCache = createCache({ ttlMs: 12 * 60 * 60 * 1000, now });
    const subsetCache = createCache({ ttlMs: 12 * 60 * 60 * 1000, now });

    async function listDates(location) {
        const url = new URL(`${ORNL_BASE_URL}/${spec.product}/dates`);
        url.searchParams.set("latitude", String(location.latitude));
        url.searchParams.set("longitude", String(location.longitude));
        const payload = await datesCache(url.toString(), () => queueOrnlRequest(() => fetchJson(url, {
            source, label, fetchImpl, timeoutMs: ORNL_TIMEOUT_MS, retries: ORNL_RETRIES
        })));
        if (!Array.isArray(payload?.dates)) {
            throw new ApiError(502, `${source.toUpperCase()}_INVALID_RESPONSE`, `${label} returned an unexpected response.`);
        }
        return payload.dates;
    }

    function selectComposites(dates, query) {
        const count = query.composites === undefined ? DEFAULT_COMPOSITES : Number(query.composites);
        if (!Number.isInteger(count) || count < 1 || count > MAX_COMPOSITES) {
            throw new ApiError(400, "INVALID_COMPOSITES", `composites must be an integer from 1 to ${MAX_COMPOSITES}.`);
        }
        for (const name of ["start", "end"]) {
            if (query[name] !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(query[name])) {
                throw new ApiError(400, `INVALID_${name.toUpperCase()}_DATE`, `${name} must be a date in YYYY-MM-DD format.`);
            }
        }
        const inRange = dates.filter((entry) =>
            (query.start === undefined || entry.calendar_date >= query.start) &&
            (query.end === undefined || entry.calendar_date <= query.end));
        // Latest composites within the range, oldest first.
        return inRange.slice(-count);
    }

    return {
        id: kind,
        name: spec.name,
        provider: "NASA ORNL DAAC MODIS/VIIRS web service",
        category: "vegetation",
        access: "values",
        measures: `16-day NDVI vegetation greenness at ${spec.resolution}`,
        link: spec.link,
        async fetch({ location, query }) {
            const dates = await listDates(location);
            const selected = selectComposites(dates, query);
            const availableRange = dates.length
                ? { first: dates[0].calendar_date, last: dates[dates.length - 1].calendar_date }
                : null;

            if (selected.length === 0) {
                return {
                    request: { start: query.start ?? null, end: query.end ?? null, product: spec.product },
                    data: { availableRange, composites: [] },
                    notes: ["No composites are available for the requested dates at this location."]
                };
            }

            const url = new URL(`${ORNL_BASE_URL}/${spec.product}/subset`);
            url.searchParams.set("latitude", String(location.latitude));
            url.searchParams.set("longitude", String(location.longitude));
            url.searchParams.set("startDate", selected[0].modis_date);
            url.searchParams.set("endDate", selected[selected.length - 1].modis_date);
            url.searchParams.set("kmAboveBelow", "0");
            url.searchParams.set("kmLeftRight", "0");
            url.searchParams.set("band", spec.band);
            const payload = await subsetCache(url.toString(), () => queueOrnlRequest(() => fetchJson(url, {
                source, label, fetchImpl, timeoutMs: ORNL_TIMEOUT_MS, retries: ORNL_RETRIES
            })));
            if (!Array.isArray(payload?.subset)) {
                throw new ApiError(502, `${source.toUpperCase()}_INVALID_RESPONSE`, `${label} returned an unexpected response.`);
            }

            const composites = payload.subset.map((entry) => {
                const raw = Array.isArray(entry.data) ? entry.data[0] : undefined;
                const valid = typeof raw === "number" && raw !== spec.fillValue;
                return {
                    date: entry.calendar_date,
                    ndvi: valid ? Number((raw * SCALE_FACTOR).toFixed(4)) : null
                };
            });

            return {
                request: {
                    start: selected[0].calendar_date,
                    end: selected[selected.length - 1].calendar_date,
                    product: spec.product,
                    band: spec.band
                },
                data: { availableRange, composites },
                notes: [
                    "NDVI ranges from -1 to 1; dense green vegetation is usually above 0.6 and bare soil is about 0.1 to 0.2.",
                    "Each value is a 16-day composite for the pixel containing the location. Cloudy composites can be null or low.",
                    ...(kind === "viirs"
                        ? ["The ORNL service publishes this VIIRS product only up to its last processed date (see availableRange)."]
                        : [])
                ]
            };
        }
    };
}

module.exports = { createVegetationSource };
