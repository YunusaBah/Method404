const { ApiError } = require("../middleware/apiError");
const { CROPS } = require("../data/crops");
const { nasaPowerService } = require("./nasaPowerService");
const { DAY_MS, climatologyWindow, isValue, toKey, validatePoint } = require("./climate");

const PARAMETERS = ["PRECTOTCORR", "T2M_MAX", "T2M_MIN"];

function emptyMonths() {
    return Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        rainMm: 0,
        rainDays: 0,
        tMaxC: 0,
        _rainTotal: 0,
        _rainDayTotal: 0,
        _tMaxTotal: 0,
        _count: 0,
        _years: new Set()
    }));
}

// Turns NASA POWER daily values into a typical year: for each calendar month,
// the average rainfall, number of rain days and mean daily maximum.
function monthlyClimatology(payload) {
    const parameters = payload?.properties?.parameter ?? {};
    const rain = parameters.PRECTOTCORR ?? {};
    const tMax = parameters.T2M_MAX ?? {};
    const months = emptyMonths();

    for (const [key, value] of Object.entries(rain)) {
        if (!/^\d{8}$/.test(key) || !isValue(value)) continue;
        const monthIndex = Number(key.slice(4, 6)) - 1;
        if (monthIndex < 0 || monthIndex > 11) continue;
        const month = months[monthIndex];
        month._rainTotal += value;
        if (value >= 1) month._rainDayTotal += 1;
        month._years.add(key.slice(0, 4));
        month._count += 1;
    }

    for (const [key, value] of Object.entries(tMax)) {
        if (!/^\d{8}$/.test(key) || !isValue(value)) continue;
        const monthIndex = Number(key.slice(4, 6)) - 1;
        if (monthIndex < 0 || monthIndex > 11) continue;
        months[monthIndex]._tMaxTotal += value;
    }

    return months.map((month) => {
        const years = Math.max(1, month._years.size);
        const days = Math.max(1, month._count);
        return {
            month: month.month,
            rainMm: Math.round(month._rainTotal / years),
            rainDays: Math.round(month._rainDayTotal / years),
            tMaxC: Math.round((month._tMaxTotal / days) * 10) / 10
        };
    });
}

function windowMonths(startMonth, seasonDays) {
    // A season that starts on the first of a month touches every month it
    // overlaps, so round up: 95 days from June covers June to September.
    const length = Math.max(1, Math.ceil(seasonDays / 30));
    return Array.from({ length }, (_, index) => ((startMonth - 1 + index) % 12) + 1);
}

// Each month of the season carries a share of the crop's total water need.
// We compare that share with the rain that actually falls in the month, so a
// crop that runs into the dry season is not credited with rain it will never
// see, and a long season cannot look good just because the window is wide.
function evaluateMonth(crop, climate, startMonth) {
    const months = windowMonths(startMonth, crop.waterWindowDays ?? crop.seasonDays);
    const needPerMonth = crop.waterNeedMm / months.length;
    const waterMaxMm = crop.waterMaxMm ?? crop.waterNeedMm * 1.8;

    let supplied = 0;
    let rainMm = 0;
    let tMaxTotal = 0;

    for (const month of months) {
        const entry = climate[month - 1];
        rainMm += entry.rainMm;
        tMaxTotal += entry.tMaxC;
        supplied += Math.min(entry.rainMm, needPerMonth);
    }

    const coverage = supplied / crop.waterNeedMm;
    const excess = Math.max(0, rainMm - waterMaxMm);
    const tMaxC = Math.round((tMaxTotal / months.length) * 10) / 10;
    const tooWet = excess > waterMaxMm * 0.15;
    const tooHot = tMaxC > crop.heatLimitC;

    let status = "good";
    if (coverage < 0.5 || tooHot) status = "poor";
    else if (coverage < 0.75 || tooWet) status = "marginal";

    const heat = Math.max(0, tMaxC - crop.heatLimitC) / 5;
    const fit = Math.max(0, Math.min(1, coverage - excess / waterMaxMm - heat));

    return {
        month: startMonth,
        status,
        rainMm,
        tMaxC,
        fit,
        tooHot,
        tooWet,
        coverage: Math.round(coverage * 100) / 100
    };
}

// Longest run of days without useful rain inside the season, taken over every
// year in the record. Days the API has no value for break the run rather than
// counting as dry, so a gap in the data cannot invent a drought.
function longestDrySpell(rainByDay, startMonth, seasonDays) {
    const years = new Set(Object.keys(rainByDay).map((key) => key.slice(0, 4)));
    let longest = 0;
    let seen = 0;

    for (const year of years) {
        const start = Date.UTC(Number(year), startMonth - 1, 1);
        let run = 0;
        for (let day = 0; day < seasonDays; day += 1) {
            const key = toKey(new Date(start + day * DAY_MS));
            const value = rainByDay[key];
            if (value === undefined) {
                run = 0;
                continue;
            }
            seen += 1;
            if (!isValue(value) || value < 1) {
                run += 1;
                longest = Math.max(longest, run);
            } else {
                run = 0;
            }
        }
    }

    return seen >= 30 ? longest : null;
}

function scoreCrop(crop, climate, rainByDay) {
    const months = climate.map((_, index) => evaluateMonth(crop, climate, index + 1));
    const good = months.filter((entry) => entry.status === "good");
    // Nudge the declared sowing months forward so a crop with no good month
    // still reports a sensible month rather than January.
    const rank = (entry) => entry.fit + (crop.sowingMonths?.includes(entry.month) ? 0.05 : 0);
    const best = [...months].sort((left, right) => rank(right) - rank(left))[0];
    const goodShare = good.length / 12;
    const score = Math.round(100 * (best.fit * 0.7 + goodShare * 0.3));

    return {
        id: crop.id,
        name: crop.name,
        score,
        waterNeedMm: crop.waterNeedMm,
        waterMaxMm: crop.waterMaxMm ?? null,
        seasonDays: crop.seasonDays,
        heatLimitC: crop.heatLimitC,
        months: months.map(({ month, status }) => ({ month, status })),
        bestMonths: good.map((entry) => entry.month),
        bestMonth: best.month,
        rainInBestMonthMm: best.rainMm,
        tMaxInBestMonthC: best.tMaxC,
        drySpellDays: longestDrySpell(rainByDay, best.month, crop.seasonDays),
        limiting:
            best.status === "good"
                ? null
                : best.tooHot
                    ? "too_hot"
                    : best.coverage < 0.75
                        ? "too_dry"
                        : "too_wet"
    };
}

function createRecommendService({
    powerService = nasaPowerService,
    now = () => Date.now()
} = {}) {
    async function getRecommendation(query) {
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

        const climate = monthlyClimatology(payload);
        if (climate.every((month) => month.tMaxC === 0)) {
            throw new ApiError(502, "CLIMATE_EMPTY", "NASA POWER returned no usable values for this point.");
        }

        const rainByDay = payload?.properties?.parameter?.PRECTOTCORR ?? {};
        const crops = CROPS
            .map((crop) => scoreCrop(crop, climate, rainByDay))
            .sort((left, right) => right.score - left.score);

        return {
            location: {
                latitude: point.latitude,
                longitude: point.longitude,
                district: typeof query.district === "string" ? query.district : null
            },
            source: "NASA POWER",
            period: { start: window.start, end: window.end },
            climate,
            crops
        };
    }

    return { getRecommendation };
}

const recommendService = createRecommendService();

module.exports = {
    createRecommendService,
    recommendService,
    monthlyClimatology,
    evaluateMonth,
    windowMonths,
    climatologyWindow,
    validatePoint
};
