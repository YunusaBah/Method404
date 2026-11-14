const { ApiError } = require("../../middleware/apiError");
const { createCache, fetchJson } = require("../external/http");

const GAEZ_IMAGE_SERVER = "https://gaez-services.fao.org/server/rest/services/res05/ImageServer";

// Crops grown in The Gambia, by GAEZ v4 crop code.
const GAMBIA_CROPS = [
    { code: "grd", crop: "Groundnut" },
    { code: "pml", crop: "Pearl millet" },
    { code: "srg", crop: "Sorghum" },
    { code: "mze", crop: "Maize" },
    { code: "rcw", crop: "Wetland rice" },
    { code: "rcd", crop: "Dryland rice" },
    { code: "cow", crop: "Cowpea" },
    { code: "csv", crop: "Cassava" },
    { code: "spo", crop: "Sweet potato" },
    { code: "oni", crop: "Onion" },
    { code: "tom", crop: "Tomato" },
    { code: "cab", crop: "Cabbage" }
];

const INPUT_LEVELS = { low: "L", high: "H" };

// GAEZ v4 suitability classes, by suitability index (0-100).
function suitabilityClass(index) {
    if (index === null) return null;
    if (index > 85) return "Very high";
    if (index > 70) return "High";
    if (index > 55) return "Good";
    if (index > 40) return "Medium";
    if (index > 25) return "Moderate";
    if (index > 10) return "Marginal";
    if (index > 0) return "Very marginal";
    return "Not suitable";
}

function createGaezSource({ fetchImpl, now } = {}) {
    const label = "The FAO GAEZ service";
    // Layer ids change only when FAO republishes GAEZ.
    const layerCache = createCache({ ttlMs: 7 * 24 * 60 * 60 * 1000, now });
    const valueCache = createCache({ ttlMs: 7 * 24 * 60 * 60 * 1000, maxEntries: 2000, now });

    async function findLayers(inputCode) {
        const names = GAMBIA_CROPS.map(({ code }) => `'sx${inputCode}r_${code}'`).join(",");
        const url = new URL(`${GAEZ_IMAGE_SERVER}/query`);
        url.searchParams.set("where", `year='1981-2010' AND model='CRUTS32' AND name IN (${names})`);
        url.searchParams.set("outFields", "objectid,name,crop");
        url.searchParams.set("returnGeometry", "false");
        url.searchParams.set("f", "json");

        const payload = await layerCache(url.toString(), () => fetchJson(url, {
            source: "gaez", label, fetchImpl, timeoutMs: 30_000
        }));
        if (!Array.isArray(payload?.features)) {
            throw new ApiError(502, "GAEZ_INVALID_RESPONSE", `${label} returned an unexpected response.`);
        }
        return new Map(payload.features.map(({ attributes }) => [attributes.name, attributes.objectid]));
    }

    async function readPixel(objectId, location) {
        const url = new URL(`${GAEZ_IMAGE_SERVER}/identify`);
        url.searchParams.set("geometry", JSON.stringify({
            x: location.longitude, y: location.latitude, spatialReference: { wkid: 4326 }
        }));
        url.searchParams.set("geometryType", "esriGeometryPoint");
        url.searchParams.set("mosaicRule", JSON.stringify({
            mosaicMethod: "esriMosaicLockRaster", lockRasterIds: [objectId]
        }));
        url.searchParams.set("returnCatalogItems", "false");
        url.searchParams.set("f", "json");

        const payload = await valueCache(url.toString(), () => fetchJson(url, {
            source: "gaez", label, fetchImpl, timeoutMs: 30_000
        }));
        const value = Number(payload?.value);
        return payload?.value === undefined || payload.value === "NoData" || !Number.isFinite(value) || value < 0
            ? null
            : value;
    }

    return {
        id: "gaez",
        name: "FAO GAEZ crop suitability",
        provider: "FAO and IIASA Global Agro-Ecological Zones v4",
        category: "crops",
        access: "values",
        measures: "Rain-fed crop suitability for 1981-2010 climate, about 9 km resolution",
        link: "https://gaez.fao.org",
        async fetch({ location, query }) {
            const input = query.input === undefined ? "low" : String(query.input).toLowerCase();
            if (!INPUT_LEVELS[input]) {
                throw new ApiError(400, "INVALID_INPUT_LEVEL", "input must be low or high.");
            }
            const inputCode = INPUT_LEVELS[input];
            const layers = await findLayers(inputCode);

            const crops = await Promise.all(GAMBIA_CROPS.map(async ({ code, crop }) => {
                const objectId = layers.get(`sx${inputCode}r_${code}`);
                const raw = objectId === undefined ? null : await readPixel(objectId, location);
                const index = raw === null ? null : Number((raw / 100).toFixed(1));
                return { crop, suitabilityIndex: index, suitabilityClass: suitabilityClass(index) };
            }));
            crops.sort((a, b) => (b.suitabilityIndex ?? -1) - (a.suitabilityIndex ?? -1));

            return {
                request: { input, waterSupply: "rainfed", period: "1981-2010" },
                data: { crops },
                notes: [
                    "The suitability index runs from 0 (not suitable) to 100 (very high) and covers all land in the grid cell.",
                    `Low input assumes traditional management without fertiliser; high input assumes improved varieties and full inputs. This response uses ${input} input.`,
                    "GAEZ is a global model. Verified local soil and crop data should take priority when available."
                ]
            };
        }
    };
}

module.exports = { GAMBIA_CROPS, createGaezSource, suitabilityClass };
