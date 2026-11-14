const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildRotationPlan } = require("../src/services/gambia/rotation");
const { estimateGrowingPeriod } = require("../src/services/gambia/climate");

const NOW = Date.parse("2026-11-14T12:00:00Z");

const gaezCrops = [
    { crop: "Pearl millet", suitabilityIndex: 52.5, suitabilityClass: "Medium" },
    { crop: "Sorghum", suitabilityIndex: 49.9, suitabilityClass: "Medium" },
    { crop: "Maize", suitabilityIndex: 41, suitabilityClass: "Medium" },
    { crop: "Cowpea", suitabilityIndex: 33.5, suitabilityClass: "Moderate" },
    { crop: "Groundnut", suitabilityIndex: 25.4, suitabilityClass: "Moderate" },
    { crop: "Cassava", suitabilityIndex: 18, suitabilityClass: "Marginal" },
    { crop: "Dryland rice", suitabilityIndex: 5, suitabilityClass: "Very marginal" },
    { crop: "Wetland rice", suitabilityIndex: 5.5, suitabilityClass: "Very marginal" },
    { crop: "Onion", suitabilityIndex: 6.9, suitabilityClass: "Very marginal" },
    { crop: "Tomato", suitabilityIndex: 27, suitabilityClass: "Moderate" },
    { crop: "Cabbage", suitabilityIndex: 0, suitabilityClass: "Not suitable" }
];
const normals = {
    source: "test",
    annualRainfallMm: 869,
    months: [],
    growingPeriod: { totalDays: 152, seasonRainfallMm: 778, rainySeasonDays: 122, storedMoistureDays: 30 }
};

test("estimates the growing period from monthly rainfall and evapotranspiration", () => {
    // Janjanbureh normals from NASA POWER (mm/day).
    const rain = [0.02, 0, 0.02, 0.01, 0.21, 2.94, 6.16, 9.62, 7.12, 2.11, 0.12, 0];
    const et0 = [4.97, 5.93, 6.94, 7.43, 7.19, 5.97, 4.55, 4.03, 3.93, 4.23, 4.67, 4.61];
    const period = estimateGrowingPeriod(rain.map((r, index) => ({ rainMmPerDay: r, et0MmPerDay: et0[index] })));

    assert.equal(period.rainySeasonStart, "06-16");
    assert.equal(period.rainySeasonEnd, "10-15");
    assert.equal(period.rainySeasonDays, 122);
    assert.ok(period.storedMoistureDays > 20 && period.storedMoistureDays < 40);
    assert.equal(estimateGrowingPeriod(rain.map(() => ({ rainMmPerDay: 0, et0MmPerDay: 5 }))), null);
});

test("alternates cereals and legumes without repeating a family", () => {
    const result = buildRotationPlan({ gaezCrops, normals, years: 4, irrigation: false, previousCrop: null, now: NOW });
    const rainy = result.plan.map((entry) => entry.rainy);

    assert.equal(result.startYear, 2027);
    assert.deepEqual(rainy.map((slot) => slot.crop), ["Pearl millet", "Cowpea", "Sorghum", "Groundnut"]);
    for (let index = 1; index < rainy.length; index += 1) {
        assert.notEqual(rainy[index].family, rainy[index - 1].family);
    }
    assert.match(rainy[1].reasons.join(" "), /Legume after Pearl millet/);
    assert.deepEqual(result.plan.map((entry) => entry.dry.status), ["fallow", "fallow", "fallow", "fallow"]);
    assert.equal(result.summary.legumeSeasons, 2);
});

test("starts with a cereal after a legume, rotates irrigated vegetable families, and filters unsuitable crops", () => {
    const result = buildRotationPlan({ gaezCrops, normals, years: 3, irrigation: true, previousCrop: "Groundnut", now: NOW });

    assert.equal(result.plan[0].rainy.role, "cereal");
    assert.match(result.plan[0].rainy.reasons.join(" "), /Cereal after Groundnut/);
    assert.deepEqual(result.plan.map((entry) => entry.dry.crop), ["Onion", "Tomato", "Cabbage"]);

    const byCrop = Object.fromEntries(result.candidates.map((candidate) => [candidate.crop, candidate]));
    assert.equal(byCrop["Dryland rice"].included, false);
    assert.match(byCrop["Dryland rice"].excludedBecause, /FAO GAEZ/);
    // Cassava survives the dry season, so a short growing period does not exclude it.
    assert.equal(byCrop.Cassava.included, true);
    // Lowland rice and irrigated vegetables are not rain-fed upland candidates.
    assert.equal(byCrop["Wetland rice"], undefined);
    assert.equal(byCrop.Tomato, undefined);
});

test("excludes crops that need a longer season and blocks the dry season after cassava", () => {
    const shortSeason = { ...normals, growingPeriod: { ...normals.growingPeriod, totalDays: 100 } };
    const result = buildRotationPlan({
        gaezCrops: [
            { crop: "Maize", suitabilityIndex: 60, suitabilityClass: "Good" },
            { crop: "Cassava", suitabilityIndex: 50, suitabilityClass: "Medium" },
            { crop: "Cowpea", suitabilityIndex: 40, suitabilityClass: "Medium" }
        ],
        normals: shortSeason,
        years: 2,
        irrigation: true,
        previousCrop: null,
        now: NOW
    });
    const maize = result.candidates.find((candidate) => candidate.crop === "Maize");

    assert.equal(maize.included, false);
    assert.match(maize.excludedBecause, /at least 125 days/);
    assert.equal(result.plan[0].rainy.crop, "Cassava");
    assert.equal(result.plan[0].dry.status, "occupied");
});
