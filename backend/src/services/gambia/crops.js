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

// FAO GAEZ v4 suitability layers available for the 1981-2010 period.
// Only crops with locally reviewed planting guidance are used as direct
// recommendations; the wider catalogue is available for individual lookup.
const GAEZ_CROP_CATALOG = [
    { code: "alf", crop: "Alfalfa" },
    { code: "ban", crop: "Banana" },
    { code: "bck", crop: "Buckwheat" },
    { code: "brl", crop: "Barley" },
    { code: "bsg", crop: "Biomass sorghum" },
    { code: "cab", crop: "Cabbage" },
    { code: "car", crop: "Carrot" },
    { code: "chk", crop: "Chickpea" },
    { code: "cit", crop: "Citrus" },
    { code: "coc", crop: "Cocoa" },
    { code: "cof", crop: "Coffee" },
    { code: "con", crop: "Coconut" },
    { code: "cot", crop: "Cotton" },
    { code: "cow", crop: "Cowpea" },
    { code: "csv", crop: "Cassava" },
    { code: "flx", crop: "Flax" },
    { code: "fml", crop: "Foxtail millet" },
    { code: "grd", crop: "Groundnut" },
    { code: "grm", crop: "Gram" },
    { code: "jtr", crop: "Jatropha" },
    { code: "mis", crop: "Miscanthus" },
    { code: "mze", crop: "Maize" },
    { code: "oat", crop: "Oat" },
    { code: "olp", crop: "Oil palm" },
    { code: "olv", crop: "Olive" },
    { code: "oni", crop: "Onion" },
    { code: "pea", crop: "Dry pea" },
    { code: "phb", crop: "Phaseolus bean" },
    { code: "pig", crop: "Pigeonpea" },
    { code: "pml", crop: "Pearl millet" },
    { code: "rcd", crop: "Dryland rice" },
    { code: "rcg", crop: "Reed canary grass" },
    { code: "rcw", crop: "Wetland rice" },
    { code: "rsd", crop: "Rapeseed" },
    { code: "rye", crop: "Rye" },
    { code: "sfl", crop: "Sunflower" },
    { code: "soy", crop: "Soybean" },
    { code: "spo", crop: "Sweet potato" },
    { code: "srg", crop: "Sorghum" },
    { code: "sub", crop: "Sugarbeet" },
    { code: "suc", crop: "Sugarcane" },
    { code: "swg", crop: "Switchgrass" },
    { code: "tea", crop: "Tea" },
    { code: "tob", crop: "Tobacco" },
    { code: "tom", crop: "Tomato" },
    { code: "whe", crop: "Wheat" },
    { code: "wpo", crop: "White potato" },
    { code: "yam", crop: "Yam" }
];

const FEATURED_CROPS = [
    { id: "rice", crop: "Rice", gaezCrops: ["Dryland rice", "Wetland rice"] },
    { id: "cassava", crop: "Cassava", gaezCrops: ["Cassava"] },
    { id: "sesame", crop: "Sesame", gaezCrops: [] },
    { id: "okra", crop: "Okra", gaezCrops: [] },
    { id: "sweet_potato", crop: "Sweet potato", gaezCrops: ["Sweet potato"] },
    { id: "watermelon", crop: "Watermelon", gaezCrops: [] },
    { id: "fonio", crop: "Fonio", gaezCrops: [] },
    { id: "bissap", crop: "Bissap (roselle)", gaezCrops: [] },
    { id: "mango", crop: "Mango", gaezCrops: [] },
    { id: "cashew", crop: "Cashew", gaezCrops: [] },
    { id: "banana", crop: "Banana", gaezCrops: ["Banana"] },
    { id: "papaya", crop: "Papaya", gaezCrops: [] },
    { id: "pineapple", crop: "Pineapple", gaezCrops: [] },
    { id: "citrus", crop: "Orange", gaezCrops: ["Citrus"] }
];

const INPUT_LEVELS = { low: "L", high: "H" };
const CROP_BY_NAME = new Map(GAEZ_CROP_CATALOG.map((entry) => [entry.crop.toLowerCase(), entry]));
const FEATURED_CROP_BY_ID = new Map(FEATURED_CROPS.map((entry) => [entry.id, entry]));

function parseInputLevel(value) {
    const input = value === undefined ? "low" : String(value).toLowerCase();
    if (!INPUT_LEVELS[input]) {
        throw new ApiError(400, "INVALID_INPUT_LEVEL", "input must be low or high.");
    }
    return input;
}

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

    async function findLayers(inputCode, crops) {
        const names = crops.map(({ code }) => `'sx${inputCode}r_${code}'`).join(",");
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
            const input = parseInputLevel(query.input);
            const inputCode = INPUT_LEVELS[input];
            let cropsToRead = GAMBIA_CROPS;
            if (query.crop !== undefined) {
                const requested = CROP_BY_NAME.get(String(query.crop).trim().toLowerCase());
                if (!requested) {
                    throw new ApiError(400, "UNKNOWN_CROP", "Choose a crop from the FAO GAEZ crop list.");
                }
                cropsToRead = [requested];
            }
            const layers = await findLayers(inputCode, cropsToRead);

            const crops = await Promise.all(cropsToRead.map(async ({ code, crop }) => {
                const objectId = layers.get(`sx${inputCode}r_${code}`);
                const raw = objectId === undefined ? null : await readPixel(objectId, location);
                const index = raw === null ? null : Number((raw / 100).toFixed(1));
                return { crop, suitabilityIndex: index, suitabilityClass: suitabilityClass(index) };
            }));
            crops.sort((a, b) => (b.suitabilityIndex ?? -1) - (a.suitabilityIndex ?? -1));

            return {
                request: {
                    input,
                    waterSupply: "rainfed",
                    period: "1981-2010",
                    ...(query.crop === undefined ? {} : { crop: cropsToRead[0].crop })
                },
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

module.exports = {
    FEATURED_CROPS,
    FEATURED_CROP_BY_ID,
    GAEZ_CROP_CATALOG,
    GAMBIA_CROPS,
    createGaezSource,
    parseInputLevel,
    suitabilityClass
};
