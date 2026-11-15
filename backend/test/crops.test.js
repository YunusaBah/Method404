const assert = require("node:assert/strict");
const { test } = require("node:test");
const { catalogue, listCrops, cropById, summary } = require("../src/services/cropService");
const { CROPS } = require("../src/data/crops");

test("the catalogue is complete and has no duplicate ids", () => {
    assert.equal(catalogue.region, "The Gambia");
    assert.equal(catalogue.crops.length, 19);
    assert.equal(new Set(catalogue.crops.map((crop) => crop.id)).size, catalogue.crops.length);

    for (const crop of catalogue.crops) {
        assert.ok(crop.name, `${crop.id} needs a name`);
        assert.ok(crop.scientificName, `${crop.id} needs a scientific name`);
        assert.ok(crop.photo.endsWith(".webp"), `${crop.id} needs a photo filename`);
        assert.ok(["annual", "orchard"].includes(crop.category), `${crop.id} has a bad category`);
        assert.ok(catalogue.sources.length >= 3, "the catalogue must cite its sources");
    }
});

test("only the seven crops with validated constants can be scored", () => {
    const scored = catalogue.crops.filter((crop) => crop.scored);
    assert.equal(scored.length, 7);

    for (const crop of scored) {
        const a = crop.agronomy;
        assert.ok(a.waterNeedMm > 0 && a.waterMaxMm > a.waterNeedMm, crop.id);
        assert.ok(a.seasonDays > 0 && a.heatLimitC > 0, crop.id);
        assert.ok(a.sowingMonths.length > 0, crop.id);
        assert.ok(crop.rotation?.family, crop.id);
    }

    for (const crop of catalogue.crops.filter((entry) => !entry.scored)) {
        assert.equal(crop.agronomy, null, `${crop.id} must not carry invented constants`);
        assert.equal(crop.rotation, null, `${crop.id} must not enter the rotation model`);
    }
});

test("the recommendation engine only sees scored crops, in its old flat shape", () => {
    assert.equal(CROPS.length, 7);
    const cassava = CROPS.find((crop) => crop.id === "cassava");
    assert.equal(cassava.waterWindowDays, 150);
    assert.equal(cassava.waterNeedMm, 800);
    assert.ok(CROPS.every((crop) => !("localNames" in crop)));
});

test("orchard crops are kept out of the seasonal model", () => {
    const orchard = listCrops({ category: "orchard" });
    assert.equal(orchard.length, 6);
    assert.ok(orchard.every((crop) => !crop.scored));
    assert.ok(orchard.every((crop) => crop.group === "fruit"));
});

test("filters can be combined", () => {
    assert.equal(listCrops({ scored: "true" }).length, 7);
    assert.equal(listCrops({ scored: "false" }).length, 12);
    assert.equal(listCrops({ category: "annual", scored: "false" }).length, 6);
    assert.equal(listCrops({ group: "cereal" }).length, 5);
    assert.deepEqual(
        listCrops({ group: "cereal" }).map((crop) => crop.id).sort(),
        ["fonio", "maize", "millet", "rice", "sorghum"],
    );
    assert.equal(listCrops({ category: "annual", group: "legume" }).length, 2);
});

test("bad filters are rejected instead of silently ignored", () => {
    assert.throws(() => listCrops({ category: "vegetable" }), { statusCode: 400, code: "INVALID_CATEGORY" });
    assert.throws(() => listCrops({ scored: "maybe" }), { statusCode: 400, code: "INVALID_SCORED" });
});

test("cropById looks up one crop and misses cleanly", () => {
    assert.equal(cropById("groundnut").scientificName, "Arachis hypogaea");
    assert.equal(cropById("not-a-crop"), null);
});

test("the summary reports what the UI needs to be honest about limits", () => {
    const result = summary(listCrops({}));
    assert.equal(result.success, true);
    assert.equal(result.count, 19);
    assert.equal(result.scoredCount, 7);
    assert.deepEqual(result.categoryCount, { annual: 13, orchard: 6 });
    assert.ok(result.crops.every((crop) => "credit" in crop));
});
