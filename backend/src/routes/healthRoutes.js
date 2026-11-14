const express = require("express");
const { getHealth } = require("../controllers/healthController");
const { getDatabaseHealth } = require("../controllers/databaseController");

const router = express.Router();

router.get("/", getHealth);
router.get("/supabase", getDatabaseHealth);

module.exports = router;
