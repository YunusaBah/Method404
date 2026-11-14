const assert = require("node:assert/strict");
const { test } = require("node:test");
const engine = require("../src/services/gambia/engine");

/**
 * Builds one synthetic May-December season. Rain starts on `onset`
 * (MM-DD) with `mmPerDay` every other day, and stops after `end` (MM-DD).
 */
function season(year, { onset = "06-20", end = "10-10", mmPerDay = 16, tMaxC = 31, onsetBurst = true } = {}) {
    const days = [];
    for (let time = Date.UTC(year, 4, 1); time <= Date.UTC(year, 11, 31); time += 86400000) {
        const date = new Date(time).toISOString().slice(0, 10);
        const monthDay = date.slice(5);
        const index = days.length;
        let rainMm = 0;
        if (monthDay >= onset && monthDay <= end) rainMm = index % 2 === 0 ? mmPerDay : 2;
        if (onsetBurst && monthDay === onset) rainMm = 25;
        days.push({ date, rainMm, tMaxC });
    }
    return { year, days };
}

function record(seasons) {
    return { seasons };
}

const profile = { soil: "loam", water: "rainfed", priorities: [], history: [], seasons: 3 };
const scenario = { dTempC: 0, dRainPct: 0 };
const wetYears = Array.from({ length: 10 }, (_, index) => season(2017 + index));

test("splits NASA POWER daily data into complete rainy seasons", () => {
    const daily = [season(2025).days, season(2026, { end: "10-31" }).days.filter((day) => day.date <= "2026-11-11")].flat();
    const seasons = engine.seasonsFromDaily(daily, 2026);

    assert.deepEqual(seasons.map((entry) => entry.year), [2025, 2026]);
    // A season that has not reached the end of October is left out.
    assert.equal(engine.seasonsFromDaily(daily.filter((day) => day.date <= "2026-09-30"), 2026).length, 1);
});

test("a crop fails without an onset of the rains and suffers when the rains end early", () => {
    const loam = { soil: "loam", water: "rainfed" };
    assert.equal(engine.simulateSeason("millet", season(2020).days, loam).outcome, "good");

    const noRain = season(2020, { onset: "12-30", onsetBurst: false });
    const failed = engine.simulateSeason("millet", noRain.days, loam);
    assert.equal(failed.outcome, "failed");
    assert.equal(failed.noOnset, true);

    // A late start and an early end: a 120-day sorghum runs out of season.
    const short = engine.simulateSeason("sorghum", season(2020, { onset: "07-20", end: "09-10" }).days, loam);
    assert.equal(short.shortSeason, true);
    assert.notEqual(short.outcome, "good");

    // Irrigation removes water limits; heat during flowering still counts.
    const irrigated = { soil: "loam", water: "irrigated" };
    assert.equal(engine.simulateSeason("maize", noRain.days, irrigated).outcome, "good");
    assert.equal(engine.simulateSeason("maize", season(2020, { tMaxC: 41 }).days, irrigated).outcome, "failed");
});

test("returns plans in the farmer app's engine contract", () => {
    const { plan } = engine.planFromRecord({ record: record(wetYears), gaezCrops: [], profile, scenario, fixed: {} });

    assert.equal(plan.status, "ok");
    assert.equal(plan.best.slots.length, 3);
    for (const slot of plan.best.slots) {
        assert.equal(slot.outcomes.length, 10);
        assert.ok(slot.outcomes.every((outcome) => ["good", "poor", "failed"].includes(outcome)));
        assert.equal(slot.rainWeekly.length, 18);
        assert.ok(["ok", "low"].includes(slot.confidence));
        assert.equal(slot.pinned, false);
    }
    assert.ok(plan.alternatives.length > 0 && plan.alternatives.length <= 4);
    const codes = ["legume_before_cereal", "same_family_twice", "water_need_low", "dry_spells_risk", "season_too_short"];
    assert.ok(plan.reasons.every((reason) => codes.includes(reason.code)));
    assert.ok(plan.reasons.length <= 3);
    assert.equal(plan.hypothetical, false);
    assert.ok(plan.details.rows.some((row) => row.tag === "observed" && /NASA POWER/.test(row.source)));
});

test("respects pinned crops, rotates families, and marks what-if plans as hypothetical", () => {
    const pinned = engine.planFromRecord({ record: record(wetYears), gaezCrops: [], profile, scenario, fixed: { 1: "maize" } }).plan;
    assert.equal(pinned.best.slots[1].crop, "maize");
    assert.equal(pinned.best.slots[1].pinned, true);

    const crops = pinned.best.slots.map((slot) => slot.crop);
    assert.notEqual(crops[0], crops[1]);

    const whatIf = engine.planFromRecord({
        record: record(wetYears), gaezCrops: [], profile, scenario: { dTempC: 0, dRainPct: -60 }, fixed: {}
    }).plan;
    assert.equal(whatIf.hypothetical, true);
    assert.ok(whatIf.details.rows.some((row) => row.tag === "hypothetical"));
    // Much less rain cannot give more good seasons.
    const goodSeasons = (plan) => plan.best.slots.flatMap((slot) => slot.outcomes).filter((o) => o === "good").length;
    const baseline = engine.planFromRecord({ record: record(wetYears), gaezCrops: [], profile, scenario, fixed: {} }).plan;
    assert.ok(goodSeasons(whatIf) <= goodSeasons(baseline));
});

test("swap options exclude the current crop and come with their record", () => {
    const input = { record: record(wetYears), gaezCrops: [], profile, scenario, fixed: {} };
    const current = engine.planFromRecord(input).plan.best.slots[0].crop;
    const options = engine.slotOptionsFromRecord(input, 0);

    assert.equal(options.length, 3);
    assert.ok(options.every((option) => option.crop !== current && option.outcomes.length === 10));
});

test("validates the farm profile and reports missing answers", () => {
    assert.deepEqual(engine.validateProfile({ cellId: "basse", soil: "unknown", water: "rainfed" }).missing, ["soil"]);
    assert.deepEqual(engine.validateProfile({ soil: "sandy", water: "rainfed" }).missing, ["location"]);
    assert.equal(engine.validateProfile({ cellId: "basse", soil: "sandy", water: "rainfed" }).district.name, "Basse");
    assert.throws(() => engine.validateProfile({ cellId: "dakar", soil: "sandy", water: "rainfed" }), /cellId must be one of/);
    assert.throws(() => engine.validateProfile({ cellId: "basse", soil: "sandy", water: "rainfed", priorities: ["speed"] }), /priorities/);
    assert.throws(() => engine.validateScenario({ dRainPct: -95 }), /dRainPct/);
    assert.throws(() => engine.validateFixed({ 5: "maize" }, 3), /fixed must map/);
    assert.deepEqual(engine.validateFixed({ 1: "maize" }, 3), { 1: "maize" });
});
