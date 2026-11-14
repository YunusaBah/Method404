const { ApiError } = require("../../middleware/apiError");
const { CROP_CALENDAR } = require("./cropCalendar");

/**
 * Rotation engine for the FarmShift farmer app (frontend/src/engine).
 *
 * It answers the app's engine contract (frontend/src/engine/contract.js)
 * with real data:
 * - Past outcomes come from replaying each crop against the last ten
 *   observed rainy seasons in NASA POWER daily rainfall and temperature
 *   for the farm's district.
 * - Long-term suitability comes from FAO GAEZ.
 * - Crop water needs and durations come from FAO guidance (cropCalendar.js).
 */

const SEASONS_IN_RECORD = 10;
const RAIN_WEEKS = 18;
// Onset rule dry day (Sivakumar, 1988).
const ONSET_DRY_DAY_MM = 1;
// Crop-stress dry day. NASA POWER rain is a grid-cell average that almost
// never reaches zero, so a day under 2.5 mm (about half a crop's daily water
// use) counts as dry when looking for dry spells.
const STRESS_DRY_DAY_MM = 2.5;
// Water the soil stores after the last good rain, used at about 5 mm a day.
const STORED_WATER_DAYS = 20;
// Latest sowing date: without a proper onset of the rains by then, a
// rain-fed crop fails that season.
const LATEST_ONSET = "08-31";

// The app's crop ids, mapped to the crop calendar and GAEZ names. Rice
// depends on the field: lowland swamp rice or upland (dryland) rice.
const CROPS = ["groundnut", "cowpea", "millet", "sorghum", "maize", "rice", "cassava"];
const CALENDAR_NAME = {
    groundnut: "Groundnut",
    cowpea: "Cowpea",
    millet: "Pearl millet",
    sorghum: "Sorghum",
    maize: "Maize",
    cassava: "Cassava"
};
const riceName = (water) => (water === "lowland" ? "Wetland rice" : "Dryland rice");

// Days from sowing to harvest for the early-maturing varieties most grown in
// the region (the durations the farmer app was designed with). FAO's generic
// ranges in cropCalendar.js describe longer full-season varieties.
const DAYS_TO_HARVEST = {
    groundnut: 110,
    cowpea: 80,
    millet: 95,
    sorghum: 120,
    maize: 100,
    rice: 130,
    cassava: 300
};

// Crop sensitivity, from general agronomy:
// - drySpell: longest dry spell (days under 2.5 mm) in the first 60 days
//   after sowing that makes the season poor, and that makes it fail.
// - heatC: daily maximum temperature above which flowering suffers.
const SENSITIVITY = {
    groundnut: { drySpell: [9, 13], heatC: 38 },
    cowpea: { drySpell: [10, 14], heatC: 40 },
    millet: { drySpell: [12, 16], heatC: 42 },
    sorghum: { drySpell: [10, 14], heatC: 40 },
    maize: { drySpell: [7, 10], heatC: 38 },
    rice: { drySpell: [6, 9], heatC: 36 },
    cassava: { drySpell: [20, 30], heatC: 42 }
};

// How well each crop suits each soil (0-1). These are the planning
// assumptions the app was designed with: groundnut and millet on light sandy
// uplands, maize and sorghum on loams, rice on heavy clay.
const SOIL_FIT = {
    sandy: { groundnut: 1, cowpea: 0.95, millet: 0.9, sorghum: 0.75, maize: 0.55, rice: 0.2, cassava: 0.7 },
    loam: { groundnut: 0.9, cowpea: 0.85, millet: 0.8, sorghum: 0.95, maize: 1, rice: 0.65, cassava: 0.85 },
    clay: { groundnut: 0.6, cowpea: 0.55, millet: 0.5, sorghum: 0.7, maize: 0.75, rice: 1, cassava: 0.7 }
};
// Share of rain a soil makes available to the crop: sandy soils drain fast,
// clay soils lose some to runoff.
const SOIL_RAIN_FACTOR = { sandy: 0.85, loam: 1, clay: 0.95 };

// District reference points (district headquarters). Ids and default soils
// match the farmer app.
const DISTRICTS = [
    { id: "banjul", name: "Banjul", defaultSoil: "sandy", latitude: 13.4549, longitude: -16.579 },
    { id: "kanifing", name: "Kanifing", defaultSoil: "sandy", latitude: 13.4432, longitude: -16.6667 },
    { id: "brikama", name: "Brikama", defaultSoil: null, latitude: 13.2667, longitude: -16.65 },
    { id: "mansakonko", name: "Mansakonko", defaultSoil: "loam", latitude: 13.4667, longitude: -15.6667 },
    { id: "kerewan", name: "Kerewan", defaultSoil: "sandy", latitude: 13.5, longitude: -16.0833 },
    { id: "kuntaur", name: "Kuntaur", defaultSoil: "clay", latitude: 13.6667, longitude: -14.8833 },
    { id: "janjanbureh", name: "Janjanbureh", defaultSoil: "clay", latitude: 13.5333, longitude: -14.7667 },
    { id: "basse", name: "Basse", defaultSoil: null, latitude: 13.3167, longitude: -14.2167 }
];

const CRITERIA = ["water", "soil", "income", "food", "labor", "risk"];
const SOILS = ["sandy", "loam", "clay", "unknown"];
const WATERS = ["rainfed", "lowland", "irrigated"];

function calendarFor(crop, water) {
    return CROP_CALENDAR[crop === "rice" ? riceName(water) : CALENDAR_NAME[crop]];
}

function familyOf(crop) {
    return { groundnut: "legume", cowpea: "legume", cassava: "root" }[crop] ?? "cereal";
}

// ---------------------------------------------------------------------------
// Request validation

function validateProfile(profile) {
    if (!profile || typeof profile !== "object") {
        throw new ApiError(400, "INVALID_PROFILE", "profile must be an object.");
    }
    const missing = [];
    if (!profile.cellId) missing.push("location");
    if (profile.soil === "unknown" || !profile.soil) missing.push("soil");
    if (!profile.water) missing.push("water");
    if (missing.length) {
        return { missing };
    }
    const district = DISTRICTS.find((entry) => entry.id === profile.cellId || entry.id === profile.districtId);
    if (!district) {
        throw new ApiError(400, "UNKNOWN_DISTRICT", `cellId must be one of: ${DISTRICTS.map((d) => d.id).join(", ")}.`);
    }
    if (!SOILS.includes(profile.soil)) {
        throw new ApiError(400, "INVALID_SOIL", `soil must be one of: ${SOILS.join(", ")}.`);
    }
    if (!WATERS.includes(profile.water)) {
        throw new ApiError(400, "INVALID_WATER", `water must be one of: ${WATERS.join(", ")}.`);
    }
    const priorities = Array.isArray(profile.priorities) ? profile.priorities : [];
    if (priorities.some((priority) => !CRITERIA.includes(priority))) {
        throw new ApiError(400, "INVALID_PRIORITIES", `priorities must only contain: ${CRITERIA.join(", ")}.`);
    }
    const history = Array.isArray(profile.history) ? profile.history : [];
    if (history.some((crop) => !CROPS.includes(crop))) {
        throw new ApiError(400, "INVALID_HISTORY", `history must only contain: ${CROPS.join(", ")}.`);
    }
    const seasons = Math.min(3, Math.max(1, Number(profile.seasons) || 3));
    return {
        district,
        profile: { soil: profile.soil, water: profile.water, priorities, history, seasons }
    };
}

function validateScenario(scenario = {}) {
    const dTempC = Number(scenario?.dTempC ?? 0);
    const dRainPct = Number(scenario?.dRainPct ?? 0);
    if (!Number.isFinite(dTempC) || dTempC < -5 || dTempC > 6) {
        throw new ApiError(400, "INVALID_SCENARIO", "scenario.dTempC must be between -5 and 6.");
    }
    if (!Number.isFinite(dRainPct) || dRainPct < -80 || dRainPct > 100) {
        throw new ApiError(400, "INVALID_SCENARIO", "scenario.dRainPct must be between -80 and 100.");
    }
    return { dTempC, dRainPct };
}

function validateFixed(fixed = {}, seasons) {
    if (fixed === null || typeof fixed !== "object" || Array.isArray(fixed)) {
        throw new ApiError(400, "INVALID_FIXED", "fixed must map season slots to crop ids.");
    }
    const result = {};
    for (const [slot, crop] of Object.entries(fixed)) {
        const index = Number(slot);
        if (!Number.isInteger(index) || index < 0 || index >= seasons || !CROPS.includes(crop)) {
            throw new ApiError(400, "INVALID_FIXED", `fixed must map slots 0-${seasons - 1} to: ${CROPS.join(", ")}.`);
        }
        result[index] = crop;
    }
    return result;
}

// ---------------------------------------------------------------------------
// Climate record

/**
 * Splits NASA POWER daily data into the last ten complete rainy seasons
 * (May to December of each year).
 */
function seasonsFromDaily(daily, lastSeasonYear) {
    const seasons = [];
    for (let year = lastSeasonYear - SEASONS_IN_RECORD + 1; year <= lastSeasonYear; year += 1) {
        const days = daily.filter((day) => day.date >= `${year}-05-01` && day.date <= `${year}-12-31`);
        // Complete once it reaches the end of October.
        if (days.length >= 184) {
            seasons.push({ year, days });
        }
    }
    return seasons;
}

function applyScenario(days, scenario) {
    const rainFactor = 1 + scenario.dRainPct / 100;
    return days.map((day) => ({
        date: day.date,
        rainMm: day.rainMm === null ? null : day.rainMm * rainFactor,
        tMaxC: day.tMaxC === null ? null : day.tMaxC + scenario.dTempC
    }));
}

/**
 * Index of the onset of the rains in one season, searched from 1 May, or -1.
 * Onset rule (Sivakumar, 1988): at least 20 mm within 3 days, with no dry
 * spell longer than 7 days in the following 30 days.
 */
function seasonOnset(days) {
    const latest = `${days[0].date.slice(0, 4)}-${LATEST_ONSET}`;
    for (let index = 0; index < days.length && days[index].date <= latest; index += 1) {
        const firstThree = days.slice(index, index + 3).reduce((sum, day) => sum + (day.rainMm ?? 0), 0);
        if (firstThree >= 20 && longestDrySpell(days.slice(index + 3, index + 33), ONSET_DRY_DAY_MM) <= 7) {
            return index;
        }
    }
    return -1;
}

/**
 * FAO effective rainfall (FAO/AGLW formula) over 30-day blocks: the share of
 * rain that stays in the root zone after runoff and deep drainage.
 */
function effectiveRain(days) {
    let total = 0;
    for (let start = 0; start < days.length; start += 30) {
        const block = days.slice(start, start + 30);
        const rain = block.reduce((sum, day) => sum + (day.rainMm ?? 0), 0);
        // Scale the monthly formula to blocks shorter than 30 days.
        const scale = block.length / 30;
        total += rain > 75 * scale ? 0.8 * rain - 25 * scale : Math.max(0, 0.6 * rain - 10 * scale);
    }
    return total;
}

/** Index of the last day with at least 10 mm, the end of the useful rains. */
function seasonEnd(days) {
    for (let index = days.length - 1; index >= 0; index -= 1) {
        if ((days[index].rainMm ?? 0) >= 10) return index;
    }
    return -1;
}

/**
 * Water need for the variety's growing time: the middle of the FAO range,
 * scaled by days, because FAO's figures are for longer full-season varieties
 * and water use grows with the days a crop is in the field.
 */
function seasonalWaterNeed(crop, calendar) {
    if (!calendar.waterNeedMm) return 400;
    const faoNeed = (calendar.waterNeedMm[0] + calendar.waterNeedMm[1]) / 2;
    const faoDays = (calendar.growingDays[0] + calendar.growingDays[1]) / 2;
    return faoNeed * Math.min(1, DAYS_TO_HARVEST[crop] / faoDays);
}

function longestDrySpell(days, dryDayMm) {
    let longest = 0;
    let current = 0;
    for (const day of days) {
        current = (day.rainMm ?? 0) < dryDayMm ? current + 1 : 0;
        longest = Math.max(longest, current);
    }
    return longest;
}

/**
 * Replays one crop in one observed season. Returns the outcome and what
 * limited it, so reasons and details can be explained.
 */
function simulateSeason(crop, days, profile) {
    const calendar = calendarFor(crop, profile.water);
    const sensitivity = SENSITIVITY[crop];
    const duration = DAYS_TO_HARVEST[crop];
    const irrigated = profile.water === "irrigated";
    const lowlandRice = profile.water === "lowland" && crop === "rice";

    let start = seasonOnset(days);
    if (start === -1) {
        if (!irrigated) {
            return { outcome: "failed", noOnset: true, rainMm: 0, drySpell: null, heatDays: 0, shortSeason: false };
        }
        start = days.findIndex((day) => day.date.endsWith("-07-01"));
    }
    const window = days.slice(start, start + duration);
    const rainMm = window.reduce((sum, day) => sum + (day.rainMm ?? 0), 0);
    const drySpell = longestDrySpell(window.slice(0, 60), STRESS_DRY_DAY_MM);
    // Flowering: roughly the middle third of the crop's life.
    const flowering = window.slice(Math.floor(duration * 0.4), Math.floor(duration * 0.7));
    const heatDays = flowering.filter((day) => (day.tMaxC ?? 0) > sensitivity.heatC).length;

    let level = 2;
    const limits = { drySpellHit: false, heatHit: false, shortSeason: false, waterShort: false };

    if (!irrigated && !lowlandRice) {
        const need = seasonalWaterNeed(crop, calendar);
        const available = effectiveRain(window) * SOIL_RAIN_FACTOR[profile.soil];
        if (available < need * 0.75) {
            level -= 2;
            limits.waterShort = true;
        } else if (available < need) {
            level -= 1;
            limits.waterShort = true;
        }
        if (drySpell >= sensitivity.drySpell[1]) {
            level -= 2;
            limits.drySpellHit = true;
        } else if (drySpell >= sensitivity.drySpell[0]) {
            level -= 1;
            limits.drySpellHit = true;
        }
        // The rains ending before the crop matures. After the last good
        // rain, stored soil water lasts about 20 days. Cassava keeps growing
        // on stored moisture.
        if (!calendar.survivesDrySeason) {
            const end = seasonEnd(days);
            const lateDays = start + duration - (end + STORED_WATER_DAYS);
            if (lateDays > 20) {
                level -= 2;
                limits.shortSeason = true;
            } else if (lateDays > 0) {
                level -= 1;
                limits.shortSeason = true;
            }
        }
    }
    if (profile.water === "lowland" && crop !== "rice" && rainMm > 900) {
        // Waterlogging in very wet years on low-lying fields.
        level -= 1;
    }
    if (heatDays > 12) {
        level -= 2;
        limits.heatHit = true;
    } else if (heatDays > 5) {
        level -= 1;
        limits.heatHit = true;
    }
    // A crop badly matched to the soil does worse in every season.
    if (SOIL_FIT[profile.soil][crop] < 0.5) {
        level -= 1;
    }

    const outcome = level >= 2 ? "good" : level >= 1 ? "poor" : "failed";
    return { outcome, noOnset: false, rainMm, drySpell, heatDays, ...limits };
}

// ---------------------------------------------------------------------------
// Ranking

// How much the farmer's chosen priorities weigh against the climate record.
const PRIORITY_WEIGHT = 2;

function priorityBoost(crop, priorities, calendar) {
    const water = seasonalWaterNeed(crop, calendar);
    let boost = 0;
    for (const priority of priorities) {
        if (priority === "water") boost += water <= 450 ? 1 : water <= 500 ? 0.5 : 0;
        if (priority === "soil") boost += familyOf(crop) === "legume" ? 1 : 0.2;
        if (priority === "income") boost += crop === "groundnut" || crop === "maize" ? 0.8 : 0.1;
        if (priority === "food") boost += familyOf(crop) === "cereal" ? 0.6 : 0.2;
        if (priority === "labor") boost += DAYS_TO_HARVEST[crop] > 120 ? 0.3 : 0.5;
        if (priority === "risk") boost += 0; // Applied from the record in scoreSequence.
    }
    return boost * PRIORITY_WEIGHT;
}

function scoreSequence(crops, cropStats, profile) {
    let score = 0;
    crops.forEach((crop, index) => {
        const stats = cropStats[crop];
        const record = (stats.good + 0.4 * stats.poor) / Math.max(stats.total, 1);
        score += record * 5;
        score += (stats.suitability ?? 30) / 100 * 2;
        score += SOIL_FIT[profile.soil][crop] * 2;
        score += priorityBoost(crop, profile.priorities, stats.calendar);
        if (profile.priorities.includes("risk")) score -= (stats.failed / Math.max(stats.total, 1)) * 3;
        if (familyOf(crop) === "legume") score += 0.8;

        const previous = index > 0 ? crops[index - 1] : profile.history.at(-1);
        if (previous) {
            if (familyOf(previous) === "legume" && familyOf(crop) === "cereal") score += 2.4;
            if (familyOf(previous) === familyOf(crop)) score -= 2.2;
            if (previous === crop) score -= 3;
        }
    });
    return score;
}

function allSequences(seasons, fixed) {
    const results = [];
    const walk = (acc) => {
        if (acc.length === seasons) {
            results.push(acc);
            return;
        }
        const options = fixed[acc.length] ? [fixed[acc.length]] : CROPS;
        for (const crop of options) walk([...acc, crop]);
    };
    walk([]);
    return results;
}

function weeklyRain(seasons, onsets, scenario) {
    // Typical weekly rain from the median onset date, averaged over the record.
    const valid = onsets.filter((onset) => onset !== -1).sort((a, b) => a - b);
    const start = valid.length ? valid[Math.floor(valid.length / 2)] : 45;
    const weeks = Array.from({ length: RAIN_WEEKS }, () => 0);
    for (const season of seasons) {
        const days = applyScenario(season.days, scenario);
        for (let week = 0; week < RAIN_WEEKS; week += 1) {
            weeks[week] += days.slice(start + week * 7, start + week * 7 + 7)
                .reduce((sum, day) => sum + (day.rainMm ?? 0), 0);
        }
    }
    return weeks.map((total) => Math.round(total / Math.max(seasons.length, 1)));
}

function medianDate(seasons, onsets) {
    const days = onsets
        .map((onset, index) => (onset === -1 ? null : seasons[index].days[onset].date.slice(5)))
        .filter(Boolean)
        .sort();
    return days.length ? days[Math.floor(days.length / 2)] : null;
}

function formatMonthDay(monthDay) {
    if (!monthDay) return "No reliable onset";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [month, day] = monthDay.split("-").map(Number);
    return `${day} ${months[month - 1]}`;
}

/**
 * Pure planning step: takes the climate record and GAEZ suitability, and
 * returns results in the farmer app's engine contract.
 */
function planFromRecord({ record, gaezCrops, profile, scenario, fixed }) {
    const hypothetical = scenario.dRainPct !== 0 || scenario.dTempC !== 0;
    const seasons = record.seasons;
    const adjusted = seasons.map((season) => applyScenario(season.days, scenario));
    const onsets = adjusted.map((days) => seasonOnset(days));
    const gaezByName = new Map(gaezCrops.map((entry) => [entry.crop, entry.suitabilityIndex]));

    const cropStats = {};
    for (const crop of CROPS) {
        const calendar = calendarFor(crop, profile.water);
        const results = adjusted.map((days) => simulateSeason(crop, days, profile));
        cropStats[crop] = {
            calendar,
            results,
            outcomes: results.map((result) => result.outcome),
            good: results.filter((result) => result.outcome === "good").length,
            poor: results.filter((result) => result.outcome === "poor").length,
            failed: results.filter((result) => result.outcome === "failed").length,
            total: results.length,
            suitability: gaezByName.get(crop === "rice" ? riceName(profile.water) : CALENDAR_NAME[crop]) ?? null
        };
    }

    const rain = weeklyRain(seasons, onsets, scenario);
    const buildSequence = (crops, pins = {}) => ({
        slots: crops.map((crop, slot) => {
            const stats = cropStats[crop];
            return {
                slot,
                crop,
                outcomes: stats.outcomes,
                rainWeekly: rain,
                confidence: stats.failed >= 4 || stats.total < SEASONS_IN_RECORD ? "low" : "ok",
                pinned: pins[slot] !== undefined
            };
        })
    });

    const ranked = allSequences(profile.seasons, fixed)
        .map((crops) => ({ crops, score: scoreSequence(crops, cropStats, profile) }))
        .sort((a, b) => b.score - a.score);
    const bestCrops = ranked[0].crops;

    const reasons = [];
    if (bestCrops.some((crop, index) => index > 0 && familyOf(bestCrops[index - 1]) === "legume" && familyOf(crop) === "cereal")) {
        reasons.push({ code: "legume_before_cereal", params: {} });
    }
    if (bestCrops.some((crop, index) => index > 0 && familyOf(bestCrops[index - 1]) === familyOf(crop))) {
        reasons.push({ code: "same_family_twice", params: {} });
    }
    const often = (crop, key) => cropStats[crop].results.filter((result) => result[key]).length >= 3;
    if (bestCrops.some((crop) => often(crop, "drySpellHit"))) {
        reasons.push({ code: "dry_spells_risk", params: {} });
    }
    if (bestCrops.some((crop) => often(crop, "shortSeason") || often(crop, "noOnset"))) {
        reasons.push({ code: "season_too_short", params: {} });
    }
    if (bestCrops.every((crop) => seasonalWaterNeed(crop, cropStats[crop].calendar) <= 450)) {
        reasons.push({ code: "water_need_low", params: {} });
    }

    const period = `${seasons[0]?.year}-${seasons.at(-1)?.year}`;
    const best = buildSequence(bestCrops, fixed);
    const details = {
        rows: best.slots.flatMap((slot) => {
            const stats = cropStats[slot.crop];
            const meanRain = Math.round(stats.results.reduce((sum, result) => sum + result.rainMm, 0) / Math.max(stats.total, 1));
            const drySeasons = stats.results.filter((result) => result.drySpellHit).length;
            const rows = [
                {
                    slot: slot.slot,
                    label: "Rain while the crop grows",
                    value: `${meanRain} mm on average`,
                    tag: hypothetical ? "hypothetical" : "observed",
                    source: `NASA POWER daily, ${period}`
                },
                {
                    slot: slot.slot,
                    label: "Typical start of the rains",
                    value: formatMonthDay(medianDate(seasons, onsets)),
                    tag: hypothetical ? "hypothetical" : "derived",
                    source: "NASA POWER, Sivakumar onset rule"
                },
                {
                    slot: slot.slot,
                    label: "Seasons with long dry spells",
                    value: `${drySeasons} of ${stats.total}`,
                    tag: hypothetical ? "hypothetical" : "derived",
                    source: `NASA POWER daily, ${period}`
                },
                {
                    slot: slot.slot,
                    label: "Days to harvest",
                    value: `About ${DAYS_TO_HARVEST[slot.crop]} days`,
                    tag: "derived",
                    source: "Early-maturing regional varieties"
                },
                {
                    slot: slot.slot,
                    label: "Good seasons in the record",
                    value: `${stats.good} of ${stats.total}`,
                    tag: hypothetical ? "hypothetical" : "modeled",
                    source: "FarmShift water-balance rules"
                }
            ];
            if (stats.suitability !== null) {
                rows.push({
                    slot: slot.slot,
                    label: "Long-term suitability",
                    value: `${Math.round(stats.suitability)} of 100`,
                    tag: "modeled",
                    source: "FAO GAEZ v4"
                });
            }
            return rows;
        })
    };

    return {
        plan: {
            status: "ok",
            best,
            alternatives: ranked
                .slice(1)
                .filter((entry) => entry.crops.join("|") !== bestCrops.join("|"))
                .slice(0, 4)
                .map((entry) => buildSequence(entry.crops)),
            reasons: reasons.slice(0, 3),
            changedSlots: [],
            hypothetical,
            details
        },
        cropStats,
        bestCrops
    };
}

function slotOptionsFromRecord(input, slot) {
    const { cropStats, bestCrops } = planFromRecord(input);
    const current = bestCrops[slot];
    return CROPS
        .filter((crop) => crop !== current)
        .map((crop) => {
            const crops = [...bestCrops];
            crops[slot] = crop;
            return { crop, score: scoreSequence(crops, cropStats, input.profile) };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(({ crop }) => ({ crop, outcomes: cropStats[crop].outcomes }));
}

module.exports = {
    CROPS,
    DAYS_TO_HARVEST,
    DISTRICTS,
    planFromRecord,
    seasonsFromDaily,
    simulateSeason,
    slotOptionsFromRecord,
    validateFixed,
    validateProfile,
    validateScenario
};
