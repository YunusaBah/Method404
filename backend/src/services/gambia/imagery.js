const { ApiError } = require("../../middleware/apiError");
const { boxAround } = require("../../config/gambia");
const { createCache, fetchJson } = require("../external/http");
const { resolveDateRange } = require("./dates");

const MAX_SCENES = 20;
const DEFAULT_SCENES = 8;

const CATALOGUES = {
    sentinel2: {
        name: "Copernicus Sentinel-2 imagery",
        provider: "ESA Copernicus Data Space Ecosystem",
        measures: "10 to 20 m optical scenes for field-scale crop and land monitoring",
        link: "https://dataspace.copernicus.eu",
        label: "The Copernicus Sentinel-2 catalogue",
        searchUrl: "https://stac.dataspace.copernicus.eu/v1/search",
        collection: "sentinel-2-l2a",
        // The Copernicus STAC API expects CQL2 filters.
        cloudFilter: (maxCloud) => ({
            "filter-lang": "cql2-json",
            filter: { op: "<=", args: [{ property: "eo:cloud_cover" }, maxCloud] }
        }),
        sortby: [{ field: "properties.datetime", direction: "desc" }]
    },
    landsat: {
        name: "Landsat Collection 2 imagery",
        provider: "USGS LandsatLook",
        measures: "30 m surface reflectance scenes from Landsat 8 and 9",
        link: "https://earthexplorer.usgs.gov/",
        label: "The USGS Landsat catalogue",
        searchUrl: "https://landsatlook.usgs.gov/stac-server/search",
        collection: "landsat-c2l2-sr",
        // LandsatLook previews redirect to a USGS login page, so they cannot be shown.
        publicThumbnails: false,
        cloudFilter: (maxCloud) => ({ query: { "eo:cloud_cover": { lte: maxCloud } } }),
        sortby: [{ field: "properties.datetime", direction: "desc" }]
    }
};

function parseIntegerOption(value, name, { min, max, fallback }) {
    if (value === undefined) {
        return fallback;
    }
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
        throw new ApiError(400, `INVALID_${name.toUpperCase()}`, `${name} must be an integer from ${min} to ${max}.`);
    }
    return number;
}

function pickAssetHref(assets, keys) {
    for (const key of keys) {
        if (assets?.[key]?.href) {
            return assets[key].href;
        }
    }
    return null;
}

function createImagerySource(kind, { fetchImpl, now } = {}) {
    const spec = CATALOGUES[kind];
    const cached = createCache({ ttlMs: 30 * 60 * 1000, now });

    return {
        id: kind,
        name: spec.name,
        provider: spec.provider,
        category: "imagery",
        access: "catalog",
        measures: spec.measures,
        link: spec.link,
        async fetch({ location, query }) {
            const range = resolveDateRange(query, {
                now, defaultDays: 60, maxDays: 731, earliest: kind === "landsat" ? "1982-01-01" : "2015-06-23"
            });
            const maxCloud = parseIntegerOption(query.maxCloud, "maxCloud", { min: 0, max: 100, fallback: 30 });
            const limit = parseIntegerOption(query.limit, "limit", { min: 1, max: MAX_SCENES, fallback: DEFAULT_SCENES });
            const bbox = boxAround(location, 0.01);
            const body = {
                collections: [spec.collection],
                bbox,
                datetime: `${range.start}T00:00:00Z/${range.end}T23:59:59Z`,
                limit,
                sortby: spec.sortby,
                ...spec.cloudFilter(maxCloud)
            };

            const payload = await cached(JSON.stringify(body), () => fetchJson(spec.searchUrl, {
                source: kind,
                label: spec.label,
                fetchImpl,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                timeoutMs: 30_000
            }));
            if (!Array.isArray(payload?.features)) {
                throw new ApiError(502, `${kind.toUpperCase()}_INVALID_RESPONSE`, `${spec.label} returned an unexpected response.`);
            }

            const scenes = payload.features.map((feature) => ({
                id: feature.id,
                datetime: feature.properties?.datetime ?? null,
                cloudCover: feature.properties?.["eo:cloud_cover"] ?? null,
                platform: feature.properties?.platform ?? null,
                thumbnail: spec.publicThumbnails === false
                    ? null
                    : pickAssetHref(feature.assets, ["thumbnail", "reduced_resolution_browse"]),
                metadata: feature.links?.find((link) => link.rel === "self")?.href ?? null
            }));

            return {
                request: { ...range, maxCloud, limit, bbox },
                data: { matched: payload.numberMatched ?? payload.context?.matched ?? null, scenes },
                notes: [
                    "These are scenes that cover the location, newest first. Pixel values are not extracted here.",
                    "Cloud cover is the scene-wide percentage reported by the provider; the location itself may be clearer or cloudier."
                ]
            };
        }
    };
}

module.exports = { createImagerySource };
