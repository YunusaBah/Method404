const { nasaPowerService } = require("../services/nasaPowerService");

async function getDailyPointData(req, res, next) {
    try {
        const data = await nasaPowerService.getDailyPointData(req.query);
        return res.status(200).json(data);
    } catch (error) {
        return next(error);
    }
}

async function getPowerObservations(req, res, next) {
    try {
        const data = await nasaPowerService.getObservations(req.query);
        return res.status(200).json(data);
    } catch (error) {
        return next(error);
    }
}

async function getPowerSummary(req, res, next) {
    try {
        const data = await nasaPowerService.getSummary(req.query);
        return res.status(200).json(data);
    } catch (error) {
        return next(error);
    }
}

module.exports = { getDailyPointData, getPowerObservations, getPowerSummary };
