const { recommendService } = require("../services/recommendService");

async function getRecommendation(req, res, next) {
    try {
        const data = await recommendService.getRecommendation(req.query);
        return res.status(200).json(data);
    } catch (error) {
        return next(error);
    }
}

module.exports = { getRecommendation };
