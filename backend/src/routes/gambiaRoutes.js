const express = require("express");
const {
    getEngineDistricts,
    getRecommendations,
    getRegion,
    getRotationPlan,
    getSourceData,
    getSummary,
    listSources,
    postEnginePlan,
    postEngineSlotOptions
} = require("../controllers/gambiaController");

const router = express.Router();

router.get("/", getRegion);
router.get("/sources", listSources);
router.get("/summary", getSummary);
router.get("/recommendations", getRecommendations);
router.get("/rotation", getRotationPlan);
// The farmer app's rotation engine (frontend/src/engine/contract.js).
router.get("/engine/districts", getEngineDistricts);
router.post("/engine/plan", postEnginePlan);
router.post("/engine/slot-options", postEngineSlotOptions);
router.get("/data/:sourceId", getSourceData);

module.exports = router;
