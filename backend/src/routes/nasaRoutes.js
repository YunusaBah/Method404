const express = require("express");
const {
    getDailyPointData,
    getPowerObservations,
    getPowerSummary
} = require("../controllers/nasaController");

const router = express.Router();

router.get("/power", getPowerObservations);
router.get("/power/summary", getPowerSummary);
router.get("/power/daily", getDailyPointData);

module.exports = router;
