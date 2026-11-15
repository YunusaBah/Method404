const express = require("express");
const { getRecommendation } = require("../controllers/recommendController");

const router = express.Router();

router.get("/", getRecommendation);

module.exports = router;
