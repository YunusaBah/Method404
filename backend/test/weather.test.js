const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
    createWeatherService,
    latestDay,
    monthlyClimatology,
    summarise
} = require("../src/services/weatherService");

const RAIN = [2, 2, 2, 1, 4, 53, 219, 304, 270, 101, 2, 10];

function payload({ rainByMonth = RAIN, tMax = 30, tMin = 20, years = ["2023", "2024"], missingTemp = false } = {}) {
    const rain = {};
    const tMaxSeries = {};
    const tMinSeries = {};
    const tMean = {};
    const humidity = {};

    for (const year of years) {
        for (let month = 1; month <= 12; month += 1) {
            const days = new Date(Date.UTC(Number(year), month, 0)).getUTCDate();
            for (let day = 1; day <= days; day += 1) {
                const key = `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
                rain[key] = rainByMonth[month - 1] / days;
                tMaxSeries[key] = missingTemp ? -999 : tMax + (month >= 3 && month <= 5 ? 5 : 0);
                tMinSeries[key] = missingTemp ? -999 : tMin;
                tMean[key] = missingTemp ? -999 : (tMaxSeries[key] + tMin) / 2;
                humidity[key] = 60;
            }
        }
    }

    return {
        properties: {
            parameter: {
                PRECTOTCORR: rain,
                T2M_MAX: tMaxSeries,
                T2M_MIN: tMinSeries,
                T2M: tMean,
                RH2M: humidity
            }
        }
    };
}

test("monthly rainfall is averaged per year, not summed across years", () => {
    const monthly = monthlyClimatology(payload());

    assert.equal(monthly[7].rainMm, 304);
    assert.equal(monthly[0].rainMm, 2);
    // 304 mm over 31 days is about 10 mm a day, so every day counts as wet.
    assert.equal(monthly[7].rainDays, 31);
    assert.equal(monthly[0].rainDays, 0);
});

test("monthly temperatures are the mean daily maximum and minimum", () => {
    const monthly = monthlyClimatology(payload({ tMax: 30, tMin: 20 }));

    assert.equal(monthly[0].tMaxC, 30);
    assert.equal(monthly[3].tMaxC, 35);
    assert.equal(monthly[0].tMinC, 20);
    assert.equal(monthly[0].humidityPct, 60);
});

test("the current conditions are the most recent day with a value", () => {
    const current = latestDay(payload());

    assert.equal(current.date, "2024-12-31");
    assert.equal(current.tMaxC, 30);
    assert.equal(current.tMinC, 20);
    assert.equal(current.humidityPct, 60);
});

test("the summary names the wet season and the total", () => {
    const summary = summarise(monthlyClimatology(payload()));

    assert.equal(summary.annualRainMm, RAIN.reduce((total, value) => total + value, 0));
    assert.equal(summary.wettestMonth, 8);
    assert.equal(summary.driestMonth, 4);
    assert.deepEqual(summary.wetMonths, [6, 7, 8, 9, 10]);
    assert.deepEqual(summary.dryMonths, [1, 2, 3, 4, 5, 11, 12]);
});

test("getWeather returns the shape the page renders", async () => {
    const service = createWeatherService({
        powerService: { getDailyPointData: async () => payload() },
        now: () => Date.parse("2025-06-15T00:00:00Z")
    });

    const weather = await service.getWeather({ lat: "13.4549", lon: "-16.579", district: "Banjul" });

    assert.equal(weather.source, "NASA POWER");
    assert.equal(weather.location.district, "Banjul");
    assert.equal(weather.monthly.length, 12);
    assert.ok(weather.current);
    assert.ok(weather.summary.annualRainMm > 900);
});

test("getWeather rejects a bad coordinate before calling NASA", async () => {
    let called = false;
    const service = createWeatherService({
        powerService: {
            getDailyPointData: async () => {
                called = true;
                return payload();
            }
        }
    });

    await assert.rejects(() => service.getWeather({ lat: "abc", lon: "0" }), {
        code: "INVALID_LATITUDE"
    });
    assert.equal(called, false);
});

test("getWeather reports an empty record instead of inventing numbers", async () => {
    const service = createWeatherService({
        powerService: { getDailyPointData: async () => payload({ missingTemp: true }) }
    });

    await assert.rejects(() => service.getWeather({ lat: "13.45", lon: "-16.58" }), {
        code: "CLIMATE_EMPTY"
    });
});
