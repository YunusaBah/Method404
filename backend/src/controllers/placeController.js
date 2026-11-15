const { resolvePlaces } = require("../services/placeService");

// GET /api/places?q=caravan&q=kerewan
// Accepts several transcripts (speech recognition alternatives) and returns
// the best match for each place across all of them.
function getPlaces(req, res, next) {
    try {
        const queries = [].concat(req.query.q ?? []).slice(0, 5);
        const requested = Number(req.query.limit ?? 6);
        const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 20) : 6;

        return res.status(200).json({
            success: true,
            ...resolvePlaces({ queries, limit })
        });
    } catch (error) {
        return next(error);
    }
}

module.exports = { getPlaces };
