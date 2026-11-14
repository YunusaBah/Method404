const { ApiError } = require("../../middleware/apiError");
const { createCache, fetchJson } = require("../external/http");
const { resolveDateRange } = require("./dates");

const CMR_GRANULES_URL = "https://cmr.earthdata.nasa.gov/search/granules.json";
const DATA_LINK_REL = "http://esipfed.org/ns/fedsearch/1.1/data#";
const MAX_GRANULES = 20;

// NASA datasets whose files require a free Earthdata Login to download. The
// public CMR catalogue lists which files cover a location; the files
// themselves are not downloaded or decoded here.
const DATASETS = {
    smap: {
        shortName: "SPL3SMP_E",
        name: "NASA SMAP soil moisture",
        measures: "Daily surface soil moisture on a 9 km grid",
        link: "https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/smap"
    },
    "gpm-imerg": {
        // The Late Run is published about two days after observation; the
        // Final Run (GPM_3IMERGDF) lags by several months.
        shortName: "GPM_3IMERGDL",
        name: "NASA GPM IMERG rainfall (Late Run)",
        measures: "Daily satellite rainfall on a 0.1 degree grid",
        link: "https://gpm.nasa.gov/data"
    },
    ecostress: {
        shortName: "ECO_L2T_LSTE",
        name: "NASA ECOSTRESS land-surface temperature",
        measures: "70 m land-surface temperature, an input to crop water stress",
        link: "https://ecostress.jpl.nasa.gov/data",
        // Each granule has several files; link the temperature layer.
        preferredFile: /_LST\.tif$/
    },
    gldas: {
        shortName: "GLDAS_NOAH025_3H",
        name: "NASA GLDAS land-surface model",
        measures: "3-hourly soil moisture, evapotranspiration and runoff on a 0.25 degree grid",
        link: "https://ldas.gsfc.nasa.gov/gldas"
    },
    "grace-fo": {
        shortName: "TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4",
        name: "NASA GRACE and GRACE-FO water storage",
        measures: "Monthly change in total land water storage",
        link: "https://grace.jpl.nasa.gov/data/get-data/"
    }
};

function pickDownloadUrl(links, preferredFile) {
    const candidates = (links || [])
        .filter((link) => link.rel === DATA_LINK_REL && !link.inherited && link.href?.startsWith("https://"))
        .map((link) => link.href);
    return (preferredFile && candidates.find((href) => preferredFile.test(href))) || candidates[0] || null;
}

function createEarthdataSource(kind, { fetchImpl, now } = {}) {
    const spec = DATASETS[kind];
    const cached = createCache({ ttlMs: 30 * 60 * 1000, now });

    return {
        id: kind,
        name: spec.name,
        provider: "NASA Earthdata CMR catalogue",
        category: "earthdata",
        access: "catalog",
        measures: spec.measures,
        link: spec.link,
        async fetch({ location, query }) {
            // Without start or end, return the latest files, however recent.
            // Providers publish on different schedules, so a fixed default
            // window would often be empty.
            const range = query.start === undefined && query.end === undefined
                ? null
                : resolveDateRange(query, { now, defaultDays: 30, maxDays: 7305, earliest: "2000-01-01" });
            const limit = query.limit === undefined ? 10 : Number(query.limit);
            if (!Number.isInteger(limit) || limit < 1 || limit > MAX_GRANULES) {
                throw new ApiError(400, "INVALID_LIMIT", `limit must be an integer from 1 to ${MAX_GRANULES}.`);
            }

            const url = new URL(CMR_GRANULES_URL);
            url.searchParams.set("short_name", spec.shortName);
            url.searchParams.set("point", `${location.longitude},${location.latitude}`);
            url.searchParams.set("sort_key", "-start_date");
            url.searchParams.set("page_size", String(limit));
            if (range) {
                url.searchParams.set("temporal", `${range.start}T00:00:00Z,${range.end}T23:59:59Z`);
            }

            const payload = await cached(url.toString(), () => fetchJson(url, {
                source: kind, label: "The NASA Earthdata catalogue", fetchImpl, timeoutMs: 20_000
            }));
            const entries = payload?.feed?.entry;
            if (!Array.isArray(entries)) {
                throw new ApiError(502, `${kind.toUpperCase().replaceAll("-", "_")}_INVALID_RESPONSE`,
                    "The NASA Earthdata catalogue returned an unexpected response.");
            }

            const granules = entries.map((entry) => ({
                id: entry.producer_granule_id || entry.title,
                start: entry.time_start ?? null,
                end: entry.time_end ?? null,
                sizeMB: entry.granule_size ? Number(Number(entry.granule_size).toFixed(2)) : null,
                downloadUrl: pickDownloadUrl(entry.links, spec.preferredFile)
            }));

            return {
                request: { shortName: spec.shortName, ...(range || {}), limit },
                data: { granules },
                notes: [
                    "These are the data files that cover this location, newest first. Values are not extracted yet.",
                    "Downloading the files requires a free NASA Earthdata Login (https://urs.earthdata.nasa.gov/)."
                ]
            };
        }
    };
}

module.exports = { EARTHDATA_DATASETS: DATASETS, createEarthdataSource };
