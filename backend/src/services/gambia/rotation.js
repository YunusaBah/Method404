const { CROP_CALENDAR } = require("./cropCalendar");

// Below this GAEZ rain-fed suitability index (0-100) a crop is "very
// marginal" or "not suitable" and is left out of rain-fed rotations.
const MIN_RAINFED_INDEX = 10;

// Score adjustments used to choose each rainy-season crop. Suitability
// (0-100) is the base; these nudge the choice towards a sound rotation.
const LEGUME_AFTER_CEREAL_BONUS = 25;
const BREAK_AFTER_LEGUME_BONUS = 15;
const RECENT_REPEAT_PENALTY = 30;
const EARLY_VARIETY_PENALTY = 5;
const LOW_RAINFALL_PENALTY = 15;

// Dry-season vegetables are rotated by family; this is the order tried.
const DRY_SEASON_ORDER = ["Onion", "Tomato", "Cabbage"];

function describeFit(calendar, growingPeriod) {
    const [minDays, maxDays] = calendar.growingDays;
    if (!growingPeriod) {
        return { fits: true, needsEarlyVariety: false, text: null };
    }
    const total = growingPeriod.totalDays;
    if (calendar.survivesDrySeason) {
        return {
            fits: total >= 90,
            needsEarlyVariety: false,
            text: `Takes ${minDays}-${maxDays} days. It only needs the ${total}-day growing period to establish, then keeps growing through the dry season on stored soil moisture.`
        };
    }
    if (minDays > total) {
        return {
            fits: false,
            needsEarlyVariety: false,
            text: `Needs at least ${minDays} days, but the growing period here averages ${total} days.`
        };
    }
    return {
        fits: true,
        needsEarlyVariety: maxDays > total,
        text: maxDays > total
            ? `Needs ${minDays}-${maxDays} days and the growing period averages ${total} days, so choose an early-maturing variety.`
            : `Needs ${minDays}-${maxDays} days, within the ${total}-day average growing period.`
    };
}

function describeWater(calendar, growingPeriod) {
    if (!calendar.waterNeedMm || !growingPeriod) {
        return { short: false, text: null };
    }
    const [low, high] = calendar.waterNeedMm;
    const rain = growingPeriod.seasonRainfallMm;
    return {
        short: low > rain,
        text: low > rain
            ? `Needs at least ${low} mm of water, more than the ${rain} mm the rainy season brings on average.`
            : `Needs ${low}-${high} mm of water; the rainy season brings about ${rain} mm on average.`
    };
}

/**
 * Lists every rain-fed upland crop with whether it can enter the rotation.
 * Lowland (swamp) rice and irrigated vegetables are handled separately.
 */
function rainySeasonCandidates(gaezCrops, growingPeriod) {
    return gaezCrops
        .filter((gaez) => CROP_CALENDAR[gaez.crop]?.system === "rainfed")
        .map((gaez) => {
            const calendar = CROP_CALENDAR[gaez.crop];
            const fit = describeFit(calendar, growingPeriod);
            const water = describeWater(calendar, growingPeriod);
            let excludedBecause = null;
            if (gaez.suitabilityIndex === null || gaez.suitabilityIndex < MIN_RAINFED_INDEX) {
                excludedBecause = "FAO GAEZ rates this location very marginal or unsuitable for it under rain-fed farming.";
            } else if (!fit.fits) {
                excludedBecause = fit.text;
            }
            return {
                crop: gaez.crop,
                role: calendar.role,
                family: calendar.family,
                suitabilityIndex: gaez.suitabilityIndex,
                suitabilityClass: gaez.suitabilityClass,
                growingDays: calendar.growingDays,
                waterNeedMm: calendar.waterNeedMm,
                fit,
                water,
                included: excludedBecause === null,
                excludedBecause
            };
        })
        .sort((a, b) => (b.suitabilityIndex ?? -1) - (a.suitabilityIndex ?? -1));
}

function scoreCandidate(candidate, history) {
    const previous = history.at(-1);
    let score = candidate.suitabilityIndex;
    if (previous?.role === "cereal" && candidate.role === "legume") score += LEGUME_AFTER_CEREAL_BONUS;
    if (previous?.role === "legume" && candidate.role !== "legume") score += BREAK_AFTER_LEGUME_BONUS;
    if (history.slice(-2).some((entry) => entry.crop === candidate.crop)) score -= RECENT_REPEAT_PENALTY;
    if (candidate.fit.needsEarlyVariety) score -= EARLY_VARIETY_PENALTY;
    if (candidate.water.short) score -= LOW_RAINFALL_PENALTY;
    return score;
}

function chooseRainyCrop(candidates, history) {
    const previous = history.at(-1);
    const usable = candidates.filter((candidate) => candidate.included);
    // Never the same crop, and preferably not the same family, two rainy
    // seasons running.
    let pool = usable.filter((candidate) => candidate.family !== previous?.family);
    let relaxedFamily = false;
    if (pool.length === 0) {
        pool = usable.filter((candidate) => candidate.crop !== previous?.crop);
        relaxedFamily = pool.length > 0;
    }
    if (pool.length === 0) {
        return null;
    }
    const ranked = pool
        .map((candidate) => ({ candidate, score: scoreCandidate(candidate, history) }))
        .sort((a, b) => b.score - a.score);
    return { choice: ranked[0].candidate, alternatives: ranked.slice(1, 3).map((entry) => entry.candidate.crop), relaxedFamily };
}

function rainyReasons(choice, previous, alternatives, relaxedFamily) {
    const reasons = [
        `${choice.suitabilityClass} long-term suitability (${Math.round(choice.suitabilityIndex)}/100, FAO GAEZ).`
    ];
    if (previous?.role === "cereal" && choice.role === "legume") {
        reasons.push(`Legume after ${previous.crop}: it adds nitrogen to the soil and breaks the cycle of cereal pests, diseases and Striga weed.`);
    } else if (previous?.role === "legume" && choice.role === "cereal") {
        reasons.push(`Cereal after ${previous.crop}: it uses the nitrogen the legume left in the soil.`);
    } else if (choice.role === "root") {
        reasons.push("A root crop breaks the cereal-legume cycle and loosens the soil.");
    } else if (!previous) {
        reasons.push(`Starts the rotation with the best-suited ${choice.role}.`);
    }
    if (relaxedFamily) {
        reasons.push(`No crop from a different family fits here, so the ${choice.family} family repeats. Watch for build-up of pests.`);
    }
    if (choice.fit.text) reasons.push(choice.fit.text);
    if (choice.water.text) reasons.push(choice.water.text);
    if (alternatives.length) reasons.push(`Alternatives: ${alternatives.join(", ")}.`);
    return reasons;
}

function chooseDrySeason({ irrigation, occupiedBy, dryHistory, gaezByCrop }) {
    if (occupiedBy) {
        return {
            crop: null,
            status: "occupied",
            reasons: [`${occupiedBy} is still in the field; it takes 8 to 12 months to mature.`]
        };
    }
    if (!irrigation) {
        return {
            crop: null,
            status: "fallow",
            reasons: [
                "No irrigation, so the field rests through the dry season.",
                "Leave crop residues on the surface to protect the soil from wind erosion and keep organic matter."
            ]
        };
    }
    const recentFamilies = dryHistory.slice(-2).map((entry) => entry.family);
    const crop = DRY_SEASON_ORDER.find((name) => !recentFamilies.includes(CROP_CALENDAR[name].family)) ?? DRY_SEASON_ORDER[0];
    const calendar = CROP_CALENDAR[crop];
    const [low, high] = calendar.waterNeedMm;
    const reasons = [
        `Irrigated dry-season vegetable from the ${calendar.family} family.`,
        recentFamilies.length
            ? `Different family from the last ${recentFamilies.length === 1 ? "dry season" : "two dry seasons"}, which limits soil-borne pests and diseases.`
            : "First dry-season crop in the plan.",
        `Needs about ${low}-${high} mm of irrigation water over ${calendar.growingDays[0]}-${calendar.growingDays[1]} days.`
    ];
    if (crop === "Tomato") {
        reasons.push("Keep tomatoes off the same bed for at least three years to reduce wilt and nematodes.");
    }
    return {
        crop,
        status: "planted",
        role: calendar.role,
        family: calendar.family,
        suitabilityIndex: gaezByCrop.get(crop)?.suitabilityIndex ?? null,
        reasons
    };
}

function firstPlanYear(now) {
    const date = new Date(now);
    // In November and December this year's rainy season is over.
    return date.getUTCMonth() + 1 >= 11 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
}

/**
 * Builds a season-by-season rotation for upland fields from FAO GAEZ
 * suitability and the NASA POWER growing period.
 */
function buildRotationPlan({ gaezCrops, normals, years, irrigation, previousCrop, now }) {
    const growingPeriod = normals?.growingPeriod ?? null;
    const candidates = rainySeasonCandidates(gaezCrops, growingPeriod);
    const gaezByCrop = new Map(gaezCrops.map((gaez) => [gaez.crop, gaez]));
    const startYear = firstPlanYear(now);

    const history = [];
    if (previousCrop) {
        const calendar = CROP_CALENDAR[previousCrop];
        history.push({ crop: previousCrop, role: calendar.role, family: calendar.family });
    }
    const dryHistory = [];
    const plan = [];

    for (let offset = 0; offset < years; offset += 1) {
        const year = startYear + offset;
        const picked = chooseRainyCrop(candidates, history);
        let rainy;
        if (picked) {
            const { choice, alternatives, relaxedFamily } = picked;
            rainy = {
                crop: choice.crop,
                status: "planted",
                role: choice.role,
                family: choice.family,
                suitabilityIndex: choice.suitabilityIndex,
                suitabilityClass: choice.suitabilityClass,
                reasons: rainyReasons(choice, history.at(-1), alternatives, relaxedFamily)
            };
            history.push({ crop: choice.crop, role: choice.role, family: choice.family });
        } else {
            rainy = {
                crop: null,
                status: "fallow",
                reasons: ["No rain-fed crop suits this location's soil and season, so the field rests."]
            };
            history.push({ crop: null, role: "fallow", family: null });
        }

        const dry = chooseDrySeason({
            irrigation,
            occupiedBy: rainy.crop === "Cassava" ? "Cassava" : null,
            dryHistory,
            gaezByCrop
        });
        if (dry.crop) dryHistory.push({ crop: dry.crop, family: dry.family });

        plan.push({
            year,
            rainy: { label: `Rainy season ${year}`, months: "June to October", ...rainy },
            dry: { label: `Dry season ${year}-${String(year + 1).slice(2)}`, months: "November to April", ...dry }
        });
    }

    const planted = plan.flatMap((entry) => [entry.rainy, entry.dry]).filter((slot) => slot.crop);
    return {
        startYear,
        growingSeason: normals
            ? { source: normals.source, annualRainfallMm: normals.annualRainfallMm, ...growingPeriod, months: normals.months }
            : null,
        plan,
        candidates: candidates.map(({ fit, water, ...candidate }) => ({
            ...candidate,
            needsEarlyVariety: fit.needsEarlyVariety,
            belowRainfallNeed: water.short
        })),
        summary: {
            years,
            legumeSeasons: planted.filter((slot) => slot.role === "legume").length,
            cerealSeasons: planted.filter((slot) => slot.role === "cereal").length,
            families: [...new Set(planted.map((slot) => slot.family))],
            crops: [...new Set(planted.map((slot) => slot.crop))]
        }
    };
}

module.exports = { buildRotationPlan, rainySeasonCandidates };
