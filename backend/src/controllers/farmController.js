const { ApiError } = require("../middleware/apiError");
const { databaseService } = require("../services/databaseService");
const { nasaPowerService } = require("../services/nasaPowerService");

async function createFarm(req, res, next) {
    try {
        const farm = await databaseService.createFarm(req.supabase, req.user.id, req.body);
        return res.status(201).json({ success: true, farm });
    } catch (error) {
        return next(error);
    }
}

async function getFarms(req, res, next) {
    try {
        const farms = await databaseService.getFarms(req.supabase);
        return res.status(200).json({ success: true, farms });
    } catch (error) {
        return next(error);
    }
}

async function updateFarm(req, res, next) {
    try {
        const farm = await databaseService.updateFarm(req.supabase, req.params.farmId, req.body);
        return res.status(200).json({ success: true, farm });
    } catch (error) {
        return next(error);
    }
}

async function saveNasaClimateObservations(req, res, next) {
    try {
        if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
            throw new ApiError(400, "INVALID_REQUEST", "Request body must be a JSON object.");
        }
        const farm = await databaseService.getFarm(req.supabase, req.params.farmId);
        const nasaData = await nasaPowerService.getDailyPointData({
            ...req.body,
            latitude: farm.latitude,
            longitude: farm.longitude
        });
        const observations = await databaseService.saveNasaClimateObservations(
            req.supabase,
            farm.id,
            farm,
            nasaData
        );
        return res.status(201).json({
            success: true,
            count: observations.length,
            observations
        });
    } catch (error) {
        return next(error);
    }
}

async function getClimateHistory(req, res, next) {
    try {
        const observations = await databaseService.getClimateHistory(
            req.supabase,
            req.params.farmId,
            req.query
        );
        return res.status(200).json({ success: true, observations });
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    createFarm,
    getClimateHistory,
    getFarms,
    saveNasaClimateObservations,
    updateFarm
};
