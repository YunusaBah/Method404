// General planting guidance for The Gambia, keyed by the crop names used by
// FAO GAEZ (see crops.js).
//
// - role / family: used by the rotation planner to alternate cereals with
//   nitrogen-fixing legumes and to avoid repeating a plant family.
// - sowingMonths: typical sowing or transplanting months (1 = January). The
//   rainy season runs from about June to October; dry-season vegetables are
//   grown from about October to February with irrigation.
// - waterNeedMm / growingDays: seasonal crop water need and growing period
//   ranges from FAO Irrigation Water Management, Training Manual 3
//   (Brouwer and Heibloem, 1986), where the manual gives them.
//
// These are broad regional norms, not field advice. Local extension services
// should confirm timing and varieties.
const CROP_CALENDAR = {
    "Groundnut": {
        role: "legume",
        family: "Fabaceae (legumes)",
        system: "rainfed",
        sowingMonths: [6, 7],
        waterNeedMm: [500, 700],
        growingDays: [130, 140],
        tip: "Sow with the first reliable rains; groundnut tolerates sandy upland soils."
    },
    "Pearl millet": {
        role: "cereal",
        family: "Poaceae (grasses)",
        system: "rainfed",
        sowingMonths: [6, 7],
        waterNeedMm: [450, 650],
        growingDays: [105, 140],
        tip: "Usually the first crop sown at the onset of the rains; drought tolerant."
    },
    "Sorghum": {
        role: "cereal",
        family: "Poaceae (grasses)",
        system: "rainfed",
        sowingMonths: [6, 7],
        waterNeedMm: [450, 650],
        growingDays: [120, 130],
        tip: "Tolerates dry spells better than maize."
    },
    "Maize": {
        role: "cereal",
        family: "Poaceae (grasses)",
        system: "rainfed",
        sowingMonths: [6, 7],
        waterNeedMm: [500, 800],
        growingDays: [125, 180],
        tip: "Needs steady rainfall and fertile soil; sensitive to dry spells at flowering."
    },
    "Wetland rice": {
        role: "cereal",
        family: "Poaceae (grasses)",
        system: "lowland",
        sowingMonths: [7, 8],
        waterNeedMm: [450, 700],
        growingDays: [90, 150],
        tip: "Grown in river-valley swamps and tidal flats once fields are flooded; field flooding needs extra water."
    },
    "Dryland rice": {
        role: "cereal",
        family: "Poaceae (grasses)",
        system: "rainfed",
        sowingMonths: [6, 7],
        waterNeedMm: [450, 700],
        growingDays: [90, 150],
        tip: "Upland rice depends entirely on rainfall; risky where the season is short."
    },
    "Cowpea": {
        role: "legume",
        family: "Fabaceae (legumes)",
        system: "rainfed",
        sowingMonths: [7, 8],
        waterNeedMm: [300, 500],
        growingDays: [95, 110],
        tip: "Short-season legume that fixes nitrogen; useful in rotation after cereals."
    },
    "Cassava": {
        role: "root",
        family: "Euphorbiaceae",
        system: "rainfed",
        sowingMonths: [6, 7],
        waterNeedMm: null,
        growingDays: [240, 365],
        // Keeps growing through the dry season on stored soil moisture.
        survivesDrySeason: true,
        tip: "Planted from stem cuttings early in the rains; tolerates drought once established."
    },
    "Sweet potato": {
        role: "root",
        family: "Convolvulaceae",
        system: "rainfed",
        sowingMonths: [7, 8],
        waterNeedMm: null,
        growingDays: [120, 150],
        tip: "Planted from vine cuttings once the soil is moist."
    },
    "Onion": {
        role: "vegetable",
        family: "Amaryllidaceae (alliums)",
        system: "irrigated",
        sowingMonths: [10, 11, 12, 1],
        waterNeedMm: [350, 550],
        growingDays: [150, 210],
        tip: "Dry-season crop grown with irrigation, usually near wells or the river."
    },
    "Tomato": {
        role: "vegetable",
        family: "Solanaceae (nightshades)",
        system: "irrigated",
        sowingMonths: [10, 11, 12, 1],
        waterNeedMm: [400, 800],
        growingDays: [135, 180],
        tip: "Grows best in the cooler dry season with irrigation; rainy-season crops suffer more disease."
    },
    "Cabbage": {
        role: "vegetable",
        family: "Brassicaceae (brassicas)",
        system: "irrigated",
        sowingMonths: [10, 11, 12, 1],
        waterNeedMm: [350, 500],
        growingDays: [120, 140],
        tip: "Cool dry-season vegetable that needs regular irrigation."
    }
};

const RAINY_SEASON_MONTHS = [6, 7, 8, 9, 10];

module.exports = { CROP_CALENDAR, RAINY_SEASON_MONTHS };
