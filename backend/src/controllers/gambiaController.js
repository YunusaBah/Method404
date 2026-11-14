const { gambiaDataService } = require("../services/gambiaDataService");

function getRegion(req, res) {
    return res.status(200).json({ success: true, ...gambiaDataService.getRegion() });
}

function listSources(req, res) {
    return res.status(200).json({ success: true, ...gambiaDataService.listSources() });
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

module.exports = { getRegion, getSourceData, getSummary, listSources };
