const express = require("express");
const { getDailyPointData } = require("../controllers/nasaController");

const router = express.Router();

router.get("/power/daily", getDailyPointData);

module.exports = router;
