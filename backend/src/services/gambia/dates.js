const { ApiError } = require("../../middleware/apiError");

const DAY_MS = 24 * 60 * 60 * 1000;

function toIsoDate(date) {
    return date.toISOString().slice(0, 10);
}

function parseIsoDate(value, name) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new ApiError(400, `INVALID_${name.toUpperCase()}_DATE`, `${name} must be a date in YYYY-MM-DD format.`);
    }
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || toIsoDate(date) !== value) {
        throw new ApiError(400, `INVALID_${name.toUpperCase()}_DATE`, `${name} must be a valid calendar date.`);
    }
    return date;
}

/**
 * Reads optional `start` and `end` (YYYY-MM-DD) from a query. Missing values
 * default to a window of `defaultDays` that ends `lagDays` before today, which
 * matches how long each provider takes to publish recent data.
 */
function resolveDateRange(query, {
    now = Date.now,
    defaultDays = 30,
    lagDays = 0,
    maxDays = 366,
    earliest = "1981-01-01"
} = {}) {
    const today = new Date(Math.floor(now() / DAY_MS) * DAY_MS);
    const end = query.end !== undefined
        ? parseIsoDate(query.end, "end")
        : new Date(today.getTime() - lagDays * DAY_MS);
    const start = query.start !== undefined
        ? parseIsoDate(query.start, "start")
        : new Date(end.getTime() - (defaultDays - 1) * DAY_MS);

    if (start > end) {
        throw new ApiError(400, "INVALID_DATE_RANGE", "start must be on or before end.");
    }
    if (end > today) {
        throw new ApiError(400, "INVALID_DATE_RANGE", "end must not be in the future.");
    }
    if (toIsoDate(start) < earliest) {
        throw new ApiError(400, "INVALID_DATE_RANGE", `start must be on or after ${earliest} for this source.`);
    }
    const days = Math.round((end - start) / DAY_MS) + 1;
    if (days > maxDays) {
        throw new ApiError(400, "INVALID_DATE_RANGE", `The date range must be ${maxDays} days or fewer for this source.`);
    }

    return { start: toIsoDate(start), end: toIsoDate(end), days };
}

module.exports = { DAY_MS, resolveDateRange, toIsoDate };
