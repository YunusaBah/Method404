const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildRecommendations, classifySoilMoisture, detectRainOnset } = require("../src/services/gambia/recommendations");

function days(start, rain) {
    const first = Date.parse(`${start}T00:00:00Z`);
    return rain.map((rainMm, index) => ({
        date: new Date(first + index * 86400000).toISOString().slice(0, 10),
        rainMm
    }));
}

const gaezCrops = [
    { crop: "Pearl millet", suitabilityIndex: 52.5, suitabilityClass: "Medium" },
    { crop: "Groundnut", suitabilityIndex: 25.4, suitabilityClass: "Moderate" },
    { crop: "Cassava", suitabilityIndex: 4, suitabilityClass: "Very marginal" },
    { crop: "Wetland rice", suitabilityIndex: 5.5, suitabilityClass: "Very marginal" },
    { crop: "Tomato", suitabilityIndex: 27, suitabilityClass: "Moderate" }
];

test("detects the onset of the rains and false starts", () => {
    const onset = detectRainOnset(days("2026-06-01", [0, 0, 8, 9, 6, 0, 2, 0, 5, 0]));
    assert.deepEqual(onset.onset, { date: "2026-06-03", rainMm: 23 });
    assert.equal(onset.started, true);

    const falseStart = detectRainOnset(days("2026-06-01", [12, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    assert.equal(falseStart.started, false);
    assert.equal(falseStart.longestDrySpellSinceDays, 9);

    assert.equal(detectRainOnset(days("2026-06-01", [5, 5, 5, 0, 0])).started, false);
});

test("classifies soil moisture for SMAP and NASA POWER units", () => {
    assert.equal(classifySoilMoisture({ value: 0.08, unit: "m³/m³" }), "dry");
    assert.equal(classifySoilMoisture({ value: 0.3, unit: "m³/m³" }), "wet");
    assert.equal(classifySoilMoisture({ value: 0.45, unit: "wetness index (0-1)" }), "moist");
    assert.equal(classifySoilMoisture(null), null);
});

test("in the dry season, field crops wait and irrigated vegetables can be planted", () => {
    const result = buildRecommendations({ month: 11, gaezCrops, input: "low", rainfall: null, soil: null, waterBalance: null });
    const byCrop = Object.fromEntries(result.crops.map((crop) => [crop.crop, crop]));

    assert.equal(result.season.current, "dry");
    assert.equal(byCrop.Tomato.group, "plant-now-irrigated");
    assert.equal(byCrop["Pearl millet"].group, "next-season");
    assert.deepEqual(byCrop["Pearl millet"].nextSowing, { month: 6, monthName: "June", monthsAway: 7 });
    // Rain-fed crops below the GAEZ threshold are flagged; lowland rice is not,
    // because grid-cell suitability does not describe river-valley swamps.
    assert.equal(byCrop.Cassava.group, "not-suitable");
    assert.equal(byCrop["Wetland rice"].group, "next-season");
    assert.deepEqual(result.crops.map((crop) => crop.crop), ["Tomato", "Pearl millet", "Groundnut", "Wetland rice", "Cassava"]);
});

test("in the sowing window, rain-fed crops depend on the onset of the rains", () => {
    const wet = { source: "test", daily: days("2026-06-01", [0, 10, 8, 7, 0, 3, 0, 4]) };
    const dry = { source: "test", daily: days("2026-06-01", [0, 2, 0, 1, 0, 0, 0, 0]) };

    const started = buildRecommendations({ month: 6, gaezCrops, input: "low", rainfall: wet, soil: null, waterBalance: null });
    const waiting = buildRecommendations({ month: 6, gaezCrops, input: "low", rainfall: dry, soil: null, waterBalance: null });

    assert.equal(started.crops.find((crop) => crop.crop === "Pearl millet").group, "plant-now");
    assert.equal(started.conditions.rainOnset.onset.date, "2026-06-02");
    assert.equal(started.conditions.rainfall.totalMm, 32);
    assert.equal(waiting.crops.find((crop) => crop.crop === "Pearl millet").group, "wait-for-rains");
    assert.match(waiting.crops.find((crop) => crop.crop === "Pearl millet").reasons.join(" "), /rains have not started/);
});
