// Crop requirements for the crops grown in The Gambia.
//
// `crops.json` is the single authoritative catalogue: names, scientific names,
// groups, scoring constants, rotation traits, photo filenames and sources all
// live there. This module only keeps the flat shape the recommendation engine
// expects, and exposes *only* crops with validated agronomy values so nothing
// unscored can ever reach the monthly scoring model by accident.

const catalogue = require("./crops.json");

const CROPS = catalogue.crops
    .filter((crop) => crop.scored)
    .map((crop) => ({ ...crop.agronomy, id: crop.id, name: crop.name }));

const CROP_BY_ID = new Map(CROPS.map((crop) => [crop.id, crop]));

module.exports = { CROPS, CROP_BY_ID, catalogue };
