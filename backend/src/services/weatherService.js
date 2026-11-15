// Current conditions and a typical year for a point, from the same NASA POWER
// record the recommendations use.

const { ApiError } = require("../middleware/apiError");
const { nasaPowerService } = require("./nasaPowerService");
const { climatologyWindow, isValue, validatePoint } = require("./climate");

const PARAMETERS = ["PRECTOTCORR", "T2M", "T2M_MAX", "T2M_MIN", "RH2M"];
const WET_MONTH_MM = 30;

function round1(value) {
    return Math.round(value * 10) / 10;
}

function blankMonths() {
    return Array.from({ length: 12 }, () => ({
        rainTotal: 0,
        rainDays: 0,
        tMaxTotal: 0,
        tMinTotal: 0,
        tMeanTotal: 0,
        humidityTotal: 0,
        samples: 0
    }));
}

function monthlyClimatology(payload) {
    const parameters = payload?.properties?.parameter ?? {};
    const rain = parameters.PRECTOTCORR ?? {};
    const tMax = parameters.T2M_MAX ?? {};
    const tMin = parameters.T2M_MIN ?? {};
    const tMean = parameters.T2M ?? {};
    const humidity = parameters.RH2M ?? {};

    const months = blankMonths();
    const years = new Set();

    for (const [key, value] of Object.entries(rain)) {
        if (!/^\d{8}$/.test(key) || !isValue(value)) continue;
        const index = Number(key.slice(4, 6)) - 1;
        if (index < 0 || index > 11) continue;
        months[index].rainTotal += value;
        if (value >= 1) months[index].rainDays += 1;
        years.add(key.slice(0, 4));
    }

    const yearCount = Math.max(1, years.size);

    for (const [key, value] of Object.entries(tMax)) {
        if (!/^\d{8}$/.test(key) || !isValue(value)) continue;
        const index = Number(key.slice(4, 6)) - 1;
        if (index < 0 || index > 11) continue;
        months[index].tMaxTotal += value;
        months[index].samples += 1;
    }

    for (const [key, value] of Object.entries(tMin)) {
        if (!/^\d{8}$/.test(key) || !isValue(value)) continue;
        const index = Number(key.slice(4, 6)) - 1;
        if (index < 0 || index > 11) continue;
        months[index].tMinTotal += value;
    }

    for (const [key, value] of Object.entries(tMean)) {
        if (!/^\d{8}$/.test(key) || !isValue(value)) continue;
        const index = Number(key.slice(4, 6)) - 1;
        if (index < 0 || index > 11) continue;
        months[index].tMeanTotal += value;
    }

    for (const [key, value] of Object.entries(humidity)) {
        if (!/^\d{8}$/.test(key) || !isValue(value)) continue;
        const index = Number(key.slice(4, 6)) - 1;
        if (index < 0 || index > 11) continue;
        months[index].humidityTotal += value;
    }

    return months.map((month, index) => ({
        month: index + 1,
        rainMm: Math.round(month.rainTotal / yearCount),
        rainDays: Math.round(month.rainDays / yearCount),
        tMaxC: month.samples > 0 ? round1(month.tMaxTotal / month.samples) : null,
        tMinC: month.samples > 0 ? round1(month.tMinTotal / month.samples) : null,
        tMeanC: month.samples > 0 ? round1(month.tMeanTotal / month.samples) : null,
        humidityPct: month.samples > 0 ? Math.round(month.humidityTotal / month.samples) : null
    }));
}

// The most recent day NASA has values for, used for "right now".
function latestDay(payload) {
    const parameters = payload?.properties?.parameter ?? {};
    const tMax = parameters.T2M_MAX ?? {};
    const keys = Object.keys(tMax)
        .filter((key) => /^\d{8}$/.test(key) && isValue(tMax[key]))
        .sort();

    const key = keys.at(-1);
    if (!key) return null;

    const read = (series) => (isValue(series?.[key]) ? round1(series[key]) : null);

    return {
        date: `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`,
        tMaxC: read(tMax),
        tMinC: read(parameters.T2M_MIN),
        tMeanC: read(parameters.T2M),
        rainMm: read(parameters.PRECTOTCORR) ?? 0,
        humidityPct: isValue(parameters.RH2M?.[key]) ? Math.round(parameters.RH2M[key]) : null
    };
}

function summarise(monthly) {
    const withRain = monthly.filter((month) => month.rainMm >= WET_MONTH_MM);
    const wettest = monthly.reduce((best, month) => (month.rainMm > best.rainMm ? month : best), monthly[0]);
    const driest = monthly.reduce((best, month) => (month.rainMm < best.rainMm ? month : best), monthly[0]);
    const withTemp = monthly.filter((month) => month.tMaxC !== null);

    return {
        annualRainMm: monthly.reduce((total, month) => total + month.rainMm, 0),
        wettestMonth: wettest.month,
        driestMonth: driest.month,
        wetMonths: withRain.map((month) => month.month),
        dryMonths: monthly.filter((month) => month.rainMm < WET_MONTH_MM).map((month) => month.month),
        meanTMaxC: withTemp.length
            ? round1(withTemp.reduce((total, month) => total + month.tMaxC, 0) / withTemp.length)
            : null
    };
}

function createWeatherService({
    powerService = nasaPowerService,
    now = () => Date.now()
} = {}) {
    async function getWeather(query) {
        const point = validatePoint(query);
        const window = climatologyWindow(now());

        let payload;
        try {
            payload = await powerService.getDailyPointData({
                latitude: point.latitude,
                longitude: point.longitude,
                start: window.start,
                end: window.end,
                parameters: PARAMETERS.join(",")
            });
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError(502, "CLIMATE_UNAVAILABLE", "Climate data could not be read.");
        }

        const monthly = monthlyClimatology(payload);
        if (monthly.every((month) => month.tMaxC === null)) {
            throw new ApiError(502, "CLIMATE_EMPTY", "NASA POWER returned no usable values for this point.");
        }

        return {
            location: {
                latitude: point.latitude,
                longitude: point.longitude,
                district: typeof query.district === "string" ? query.district : null
            },
            source: "NASA POWER",
            period: window,
            current: latestDay(payload),
            monthly,
            summary: summarise(monthly)
        };
    }

    return { getWeather };
}

const weatherService = createWeatherService();

module.exports = { createWeatherService, latestDay, monthlyClimatology, summarise, weatherService };
