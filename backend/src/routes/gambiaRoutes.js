const express = require("express");
const { getRegion, getSourceData, getSummary, listSources } = require("../controllers/gambiaController");

const router = express.Router();

router.get("/", getRegion);
router.get("/sources", listSources);
router.get("/summary", getSummary);
router.get("/data/:sourceId", getSourceData);

module.exports = router;
