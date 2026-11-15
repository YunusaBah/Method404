const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
    createRecommendService,
    evaluateMonth,
    monthlyClimatology,
    scoreEstablishmentCrop,
    validatePoint,
    windowMonths
} = require("../src/services/recommendService");

// A typical Gambian year: nothing from November to May, a wet June to October.
const rainByMonth = [0, 0, 0, 0, 0, 60, 220, 350, 300, 90, 0, 0];

function buildPayload(years = ["2023", "2024"]) {
    const rain = {};
    const tMax = {};
    for (const year of years) {
        for (let month = 1; month <= 12; month += 1) {
            const days = new Date(Date.UTC(Number(year), month, 0)).getUTCDate();
            for (let day = 1; day <= days; day += 1) {
                const key = `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
                rain[key] = rainByMonth[month - 1] / days;
                tMax[key] = 30 + (month >= 3 && month <= 5 ? 5 : 0);
            }
        }
    }
    return { properties: { parameter: { PRECTOTCORR: rain, T2M_MAX: tMax, T2M_MIN: tMax } } };
}

test("averages daily values into a typical year", () => {
    const climate = monthlyClimatology(buildPayload());
    assert.equal(climate.length, 12);
    assert.equal(climate[0].rainMm, 0);
    assert.equal(climate[7].rainMm, 350);
    assert.equal(climate[3].tMaxC, 35);
    assert.equal(climate[11].tMaxC, 30);
    assert.equal(climate[7].rainDays, 31);
});

test("a sowing window is the crop season rounded to months", () => {
    assert.deepEqual(windowMonths(6, 95), [6, 7, 8, 9]);
    assert.deepEqual(windowMonths(11, 90), [11, 12, 1]);
});

test("a dry sowing month is poor and a wet one is good", () => {
    const climate = monthlyClimatology(buildPayload());
    const millet = { id: "millet", waterNeedMm: 350, waterMaxMm: 1000, seasonDays: 95, heatLimitC: 42 };

    assert.equal(evaluateMonth(millet, climate, 1).status, "poor");
    assert.equal(evaluateMonth(millet, climate, 6).status, "good");
});

test("heat above the crop limit makes the month poor", () => {
    const climate = monthlyClimatology(buildPayload());
    const maize = { id: "maize", waterNeedMm: 600, seasonDays: 100, heatLimitC: 29 };
    assert.equal(evaluateMonth(maize, climate, 6).tooHot, true);
    assert.equal(evaluateMonth(maize, climate, 6).status, "poor");
});

test("orchard establishment estimates compare annual rain and mean monthly heat", () => {
    const climate = monthlyClimatology(buildPayload());
    const profile = {
        id: "mango",
        name: "Mango",
        annualRainMinMm: 800,
        annualRainMaxMm: 2000,
        heatLimitC: 38
    };

    assert.deepEqual(scoreEstablishmentCrop(profile, climate), {
        id: "mango",
        name: "Mango",
        score: 100,
        annualRainMm: 1020,
        meanMaxTemperatureC: 31.3,
        limiting: null
    });

    const dryProfile = { ...profile, annualRainMinMm: 1500 };
    assert.equal(scoreEstablishmentCrop(dryProfile, climate).limiting, "too_dry");
});

test("rejects coordinates outside the valid range", () => {
    assert.deepEqual(validatePoint({ lat: "13.45", lon: "-16.58" }), {
        latitude: 13.45,
        longitude: -16.58
    });
    assert.throws(() => validatePoint({ lat: "91", lon: "0" }), /lat must be/);
    assert.throws(() => validatePoint({ lat: "0", lon: "181" }), /lon must be/);
});

test("ranks every crop and reports the months that suit it", async () => {
    const service = createRecommendService({
        powerService: { getDailyPointData: async () => buildPayload() },
        now: () => Date.parse("2025-06-15T00:00:00Z")
    });

    const result = await service.getRecommendation({ lat: "13.45", lon: "-16.58", district: "Banjul" });

    assert.equal(result.source, "NASA POWER");
    assert.equal(result.location.district, "Banjul");
    assert.equal(result.climate.length, 12);
    assert.equal(result.crops.length, 7);

    for (const crop of result.crops) {
        assert.equal(crop.months.length, 12);
        assert.ok(Array.isArray(crop.bestMonths));
        assert.ok(crop.score >= 0 && crop.score <= 100);
    }

    const scores = result.crops.map((crop) => crop.score);
    assert.deepEqual(scores, [...scores].sort((left, right) => right - left));

    const groundnut = result.crops.find((crop) => crop.id === "groundnut");
    assert.ok(groundnut.bestMonths.includes(6), "June should suit groundnut in a wet year");
});
