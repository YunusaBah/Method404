const { ApiError } = require("../middleware/apiError");
const { cropById, listCrops, summary } = require("../services/cropService");

function getCrops(req, res, next) {
    try {
        return res.status(200).json(summary(listCrops(req.query)));
    } catch (error) {
        return next(error);
    }
}

function getCrop(req, res, next) {
    try {
        const crop = cropById(req.params.id);
        if (!crop) {
            throw new ApiError(404, "CROP_NOT_FOUND", `No crop called ${req.params.id} in the catalogue.`);
        }
        return res.status(200).json({ success: true, crop });
    } catch (error) {
        return next(error);
    }
}

module.exports = { getCrops, getCrop };
