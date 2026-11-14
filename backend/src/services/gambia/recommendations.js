const { CROP_CALENDAR, RAINY_SEASON_MONTHS } = require("./cropCalendar");

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// Onset of the rains (Sivakumar, 1988, widely used in the Sahel): at least
// 20 mm within 3 consecutive days, not followed by a dry spell longer than
// 7 days. A day under 1 mm counts as dry.
const ONSET_RAIN_MM = 20;
const ONSET_WINDOW_DAYS = 3;
const MAX_DRY_SPELL_DAYS = 7;
const DRY_DAY_MM = 1;

// Below this GAEZ rain-fed suitability index (0-100) a rain-fed crop is
// "very marginal" or "not suitable" in GAEZ terms.
const MIN_RAINFED_INDEX = 10;

const GROUP_ORDER = ["plant-now", "plant-now-irrigated", "wait-for-rains", "next-season", "not-suitable"];

function monthList(months) {
    return months.map((month) => MONTH_NAMES[month - 1]).join(", ");
}

/**
 * Looks for the onset of the rains in a daily rainfall series
 * ([{ date, rainMm }], oldest first). Returns the onset date and whether a
 * long dry spell followed it (a "false start").
 */
function detectRainOnset(daily) {
    const days = daily.filter((day) => typeof day.rainMm === "number");
    let onset = null;
    for (let index = days.length - ONSET_WINDOW_DAYS; index >= 0; index -= 1) {
        const window = days.slice(index, index + ONSET_WINDOW_DAYS);
        const total = window.reduce((sum, day) => sum + day.rainMm, 0);
        if (total >= ONSET_RAIN_MM) {
            onset = { date: window[0].date, rainMm: Number(total.toFixed(1)) };
            break;
        }
    }
    if (!onset) {
        return { started: false, onset: null, longestDrySpellSinceDays: null };
    }

    let longest = 0;
    let current = 0;
    for (const day of days.filter((entry) => entry.date > onset.date)) {
        current = day.rainMm < DRY_DAY_MM ? current + 1 : 0;
        longest = Math.max(longest, current);
    }
    return {
        started: longest <= MAX_DRY_SPELL_DAYS,
        onset,
        longestDrySpellSinceDays: longest
    };
}

function classifySoilMoisture(soil) {
    if (!soil) return null;
    // Rough thresholds for the sandy and loamy soils common in The Gambia.
    const [dry, wet] = soil.unit === "m³/m³" ? [0.1, 0.25] : [0.3, 0.6];
    if (soil.value < dry) return "dry";
    if (soil.value > wet) return "wet";
    return "moist";
}

/**
 * Builds crop recommendations from long-term suitability (GAEZ) and current
 * conditions. Every decision is returned as a plain-language reason.
 */
function buildRecommendations({ month, gaezCrops, input, rainfall, soil, waterBalance }) {
    const season = RAINY_SEASON_MONTHS.includes(month) ? "rainy" : "dry";
    const onset = season === "rainy" && rainfall ? detectRainOnset(rainfall.daily) : null;
    const soilStatus = classifySoilMoisture(soil);

    const crops = gaezCrops.map((gaez) => {
        const calendar = CROP_CALENDAR[gaez.crop];
        const index = gaez.suitabilityIndex;
        const reasons = [];
        const inWindow = calendar.sowingMonths.includes(month);

        reasons.push(index === null
            ? "No FAO GAEZ suitability value for this location."
            : `Long-term rain-fed suitability: ${gaez.suitabilityClass} (${Math.round(index)}/100, FAO GAEZ, ${input} input).`);
        reasons.push(`Typical sowing: ${monthList(calendar.sowingMonths)}.`);

        let group;
        if (calendar.system === "lowland") {
            reasons.push("Depends on flooded river-valley or tidal fields, which the grid-cell suitability above does not capture. Suitable only where such fields exist.");
        }
        if (calendar.system === "rainfed" && (index === null || index < MIN_RAINFED_INDEX)) {
            group = "not-suitable";
            reasons.push("GAEZ rates this location very marginal or unsuitable for this crop under rain-fed farming.");
        } else if (calendar.system === "irrigated") {
            group = inWindow ? "plant-now-irrigated" : "next-season";
            reasons.push("Grown with irrigation, so the rain-fed suitability above understates what is possible with water.");
        } else if (!inWindow) {
            group = "next-season";
        } else if (onset?.started) {
            group = "plant-now";
            reasons.push(`The rains have started: ${onset.onset.rainMm} mm fell in 3 days from ${onset.onset.date}.`);
        } else {
            group = "wait-for-rains";
            reasons.push(onset?.onset
                ? `Rain began on ${onset.onset.date}, but a ${onset.longestDrySpellSinceDays}-day dry spell followed (a false start). Wait for steadier rain.`
                : "The sowing window is open, but the rains have not started yet (no 20 mm within 3 days recently).");
        }

        let nextSowing = null;
        if (group === "next-season") {
            const monthsAway = Math.min(...calendar.sowingMonths.map((sowing) => (sowing - month + 12) % 12));
            const nextMonth = ((month - 1 + monthsAway) % 12) + 1;
            nextSowing = { month: nextMonth, monthName: MONTH_NAMES[nextMonth - 1], monthsAway };
            reasons.push(`Next sowing window opens in ${MONTH_NAMES[nextMonth - 1]} (${monthsAway} month${monthsAway === 1 ? "" : "s"} from now).`);
        }

        if (calendar.waterNeedMm) {
            const [low, high] = calendar.waterNeedMm;
            reasons.push(calendar.system === "irrigated"
                ? `Needs about ${low}-${high} mm of irrigation water over the season.`
                : `Needs about ${low}-${high} mm of water over ${calendar.growingDays[0]}-${calendar.growingDays[1]} days.`);
        }
        if (calendar.system !== "irrigated" && group === "plant-now" && soilStatus === "dry") {
            reasons.push("Topsoil is still dry; sow after the next good rain.");
        }

        return {
            crop: gaez.crop,
            group,
            system: calendar.system,
            suitabilityIndex: index,
            suitabilityClass: gaez.suitabilityClass,
            sowingMonths: calendar.sowingMonths,
            nextSowing,
            waterNeedMm: calendar.waterNeedMm,
            growingDays: calendar.growingDays,
            tip: calendar.tip,
            reasons
        };
    });

    crops.sort((a, b) =>
        GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
        (b.suitabilityIndex ?? -1) - (a.suitabilityIndex ?? -1));

    return {
        season: {
            current: season,
            month,
            monthName: MONTH_NAMES[month - 1],
            description: season === "rainy"
                ? "Rainy season (about June to October): rain-fed field crops are sown and grown."
                : "Dry season (about November to May): field crops wait for the rains; vegetables are grown with irrigation."
        },
        conditions: {
            rainfall: rainfall
                ? {
                    source: rainfall.source,
                    start: rainfall.daily[0]?.date ?? null,
                    end: rainfall.daily.at(-1)?.date ?? null,
                    totalMm: Number(rainfall.daily.reduce((sum, day) => sum + (day.rainMm ?? 0), 0).toFixed(1)),
                    rainyDays: rainfall.daily.filter((day) => (day.rainMm ?? 0) >= DRY_DAY_MM).length
                }
                : null,
            rainOnset: onset,
            soilMoisture: soil ? { ...soil, status: soilStatus } : null,
            waterBalance
        },
        crops
    };
}

module.exports = { buildRecommendations, classifySoilMoisture, detectRainOnset };
