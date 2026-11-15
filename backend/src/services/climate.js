// Shared plumbing for the NASA POWER callers: date windows, fill values and
// point validation. Both the recommendation and the weather service use these
// so they always agree on which days they are talking about.

const { ApiError } = require("../middleware/apiError");

const DAY_MS = 24 * 60 * 60 * 1000;
// NASA POWER writes -999 for a day it has no value for.
const FILL_VALUE = -900;

function isValue(value) {
    return Number.isFinite(value) && value > FILL_VALUE;
}

function toKey(date) {
    return date.toISOString().slice(0, 10).replace(/-/g, "");
}

// The last N complete years, ending a month ago so the most recent days are
// not missing from the NASA record.
function climatologyWindow(now, years = 3) {
    const end = new Date(now - 31 * DAY_MS);
    const start = new Date(end);
    start.setUTCFullYear(end.getUTCFullYear() - years);
    start.setUTCDate(start.getUTCDate() + 1);
    return { start: toKey(start), end: toKey(end) };
}

function validatePoint(query) {
    const latitude = Number(query.lat ?? query.latitude);
    const longitude = Number(query.lon ?? query.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        throw new ApiError(400, "INVALID_LATITUDE", "lat must be a number between -90 and 90.");
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        throw new ApiError(400, "INVALID_LONGITUDE", "lon must be a number between -180 and 180.");
    }
    return { latitude, longitude };
}

module.exports = { DAY_MS, FILL_VALUE, climatologyWindow, isValue, toKey, validatePoint };
