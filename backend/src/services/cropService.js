// The single crop catalogue. Nothing here is fetched at runtime: the list of
// crops grown in The Gambia is small, stable reference data, so it is committed
// to the repo with its sources. `photo-credits.json` is generated once by the
// image pipeline and only adds attribution metadata.

const fs = require("node:fs");
const path = require("node:path");
const { ApiError } = require("../middleware/apiError");

const catalogue = require("../data/crops.json");
const CREDITS_PATH = path.join(__dirname, "../data/photo-credits.json");
const CATEGORIES = ["annual", "orchard"];

function loadCredits() {
    try {
        return JSON.parse(fs.readFileSync(CREDITS_PATH, "utf8"));
    } catch {
        return {};
    }
}

function parseScored(value) {
    if (value === undefined) return null;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new ApiError(400, "INVALID_SCORED", "scored must be true or false.");
}

function parseCategory(value) {
    if (value === undefined) return null;
    if (!CATEGORIES.includes(value)) {
        throw new ApiError(400, "INVALID_CATEGORY", `category must be one of: ${CATEGORIES.join(", ")}.`);
    }
    return value;
}

function decorate(crop, credits) {
    return { ...crop, credit: credits[crop.id] ?? null };
}

function listCrops(query = {}) {
    const category = parseCategory(query.category);
    const scored = parseScored(query.scored);
    const group = query.group || null;
    const credits = loadCredits();

    return catalogue.crops
        .filter((crop) => (category === null || crop.category === category))
        .filter((crop) => (scored === null || crop.scored === scored))
        .filter((crop) => (group === null || crop.group === group))
        .map((crop) => decorate(crop, credits));
}

function cropById(id) {
    const crop = catalogue.crops.find((entry) => entry.id === id);
    return crop ? decorate(crop, loadCredits()) : null;
}

function summary(crops) {
    return {
        success: true,
        region: catalogue.region,
        version: catalogue.version,
        sources: catalogue.sources,
        count: crops.length,
        scoredCount: crops.filter((crop) => crop.scored).length,
        categoryCount: CATEGORIES.reduce((totals, category) => {
            totals[category] = crops.filter((crop) => crop.category === category).length;
            return totals;
        }, {}),
        crops
    };
}

module.exports = { catalogue, listCrops, cropById, summary, CATEGORIES };
