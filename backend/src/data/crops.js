// Crop profiles for the crops grown in The Gambia.
//
// `crops.json` is the single authoritative catalogue: names, scientific names,
// scoring constants, prediction profiles, rotation traits and photo filenames
// all live there. The recommendation engine still receives only validated
// agronomy; exploratory estimates are exposed separately for crop lookup.

const catalogue = require("./crops.json");

const CROPS = catalogue.crops
    .filter((crop) => crop.scored)
    .map((crop) => ({ ...crop.agronomy, id: crop.id, name: crop.name }));

const CROP_BY_ID = new Map(CROPS.map((crop) => [crop.id, crop]));
const PREDICTION_CROPS = new Map(catalogue.crops
    .filter((crop) => crop.scored || crop.predictionProfile)
    .map((crop) => {
        const profile = crop.predictionProfile;
        return [crop.id, {
            id: crop.id,
            name: crop.name,
            type: profile?.type || "season",
            confidence: profile ? "estimated" : "verified",
            basis: profile?.basis || "Reviewed crop requirements.",
            ...(profile?.type === "establishment"
                ? profile
                : { agronomy: profile?.agronomy || crop.agronomy })
        }];
    }));

module.exports = { CROPS, CROP_BY_ID, PREDICTION_CROPS, catalogue };
