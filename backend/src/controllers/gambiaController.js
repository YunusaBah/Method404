const { gambiaDataService } = require("../services/gambiaDataService");

function getRegion(req, res) {
    return res.status(200).json({ success: true, ...gambiaDataService.getRegion() });
}

function listSources(req, res) {
    return res.status(200).json({ success: true, ...gambiaDataService.listSources() });
}

function listCrops(req, res) {
    return res.status(200).json({ success: true, ...gambiaDataService.listCrops() });
}

async function getCropPrediction(req, res, next) {
    try {
        return res.status(200).json(await gambiaDataService.getCropPrediction(req.params.crop, req.query));
    } catch (error) {
        return next(error);
    }
}

async function getSummary(req, res, next) {
    try {
        return res.status(200).json(await gambiaDataService.getSummary(req.query));
    } catch (error) {
        return next(error);
    }
}

async function getSourceData(req, res, next) {
    try {
        return res.status(200).json(await gambiaDataService.getSourceData(req.params.sourceId, req.query));
    } catch (error) {
        return next(error);
    }
}

async function getRecommendations(req, res, next) {
    try {
        return res.status(200).json(await gambiaDataService.getRecommendations(req.query));
    } catch (error) {
        return next(error);
    }
}

async function getRotationPlan(req, res, next) {
    try {
        return res.status(200).json(await gambiaDataService.getRotationPlan(req.query));
    } catch (error) {
        return next(error);
    }
}

function getEngineDistricts(req, res) {
    return res.status(200).json({ success: true, districts: gambiaDataService.engineDistricts() });
}

async function postEnginePlan(req, res, next) {
    try {
        return res.status(200).json(await gambiaDataService.enginePlan(req.body));
    } catch (error) {
        return next(error);
    }
}

async function postEngineSlotOptions(req, res, next) {
    try {
        return res.status(200).json(await gambiaDataService.engineSlotOptions(req.body));
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    getCropPrediction,
    getEngineDistricts,
    getRecommendations,
    getRegion,
    getRotationPlan,
    getSourceData,
    getSummary,
    listCrops,
    listSources,
    postEnginePlan,
    postEngineSlotOptions
};
