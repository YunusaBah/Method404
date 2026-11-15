const express = require("express");
const { getCrop, getCrops } = require("../controllers/cropController");

const router = express.Router();

router.get("/", getCrops);
router.get("/:id", getCrop);

module.exports = router;
