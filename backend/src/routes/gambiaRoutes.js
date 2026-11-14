const express = require("express");
const {
    getRecommendations, getRegion, getRotationPlan, getSourceData, getSummary, listSources
} = require("../controllers/gambiaController");

const router = express.Router();

router.get("/", getRegion);
router.get("/sources", listSources);
router.get("/summary", getSummary);
router.get("/recommendations", getRecommendations);
router.get("/rotation", getRotationPlan);
router.get("/data/:sourceId", getSourceData);

module.exports = router;
