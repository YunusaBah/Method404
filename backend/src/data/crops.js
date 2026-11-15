// Crop requirements for the crops grown in The Gambia.
//
// waterNeedMm / waterMaxMm bound the rain a crop wants across its whole season:
// below the minimum it is short of water, above the maximum the seed or roots
// suffer. seasonDays is roughly sowing to harvest, heatLimitC is the mean daily
// maximum the crop tolerates without a yield penalty. The values are drawn from
// FAO / IITA crop summaries and are deliberately coarse: this tool gives
// guidance, not a prescription.

const CROPS = [
    {
        id: "groundnut",
        name: "Groundnut",
        waterNeedMm: 520,
        waterMaxMm: 900,
        seasonDays: 110,
        heatLimitC: 38,
        sowingMonths: [6, 7],
        soil: "sandy"
    },
    {
        id: "cowpea",
        name: "Cowpea",
        waterNeedMm: 380,
        waterMaxMm: 800,
        seasonDays: 80,
        heatLimitC: 40,
        sowingMonths: [7, 8],
        soil: "sandy"
    },
    {
        id: "millet",
        name: "Millet",
        waterNeedMm: 350,
        waterMaxMm: 1000,
        seasonDays: 95,
        heatLimitC: 42,
        sowingMonths: [6, 7],
        soil: "sandy"
    },
    {
        id: "sorghum",
        name: "Sorghum",
        waterNeedMm: 480,
        waterMaxMm: 1000,
        seasonDays: 120,
        heatLimitC: 40,
        sowingMonths: [6, 7],
        soil: "loam"
    },
    {
        id: "maize",
        name: "Maize",
        waterNeedMm: 600,
        waterMaxMm: 1000,
        seasonDays: 100,
        heatLimitC: 36,
        sowingMonths: [6, 7],
        soil: "loam"
    },
    {
        id: "rice",
        name: "Rice",
        waterNeedMm: 1100,
        waterMaxMm: 2000,
        seasonDays: 135,
        heatLimitC: 38,
        sowingMonths: [6, 7, 8],
        soil: "clay"
    },
    {
        id: "cassava",
        name: "Cassava",
        waterNeedMm: 800,
        waterMaxMm: 1800,
        seasonDays: 300,
        // Cassava keeps growing long after the rains stop; only the first
        // months need rain to establish the stand.
        waterWindowDays: 150,
        heatLimitC: 40,
        sowingMonths: [6, 7, 8],
        soil: "loam"
    }
];

const CROP_BY_ID = new Map(CROPS.map((crop) => [crop.id, crop]));

module.exports = { CROPS, CROP_BY_ID };
