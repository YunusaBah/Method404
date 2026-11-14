const express = require("express");
const requireSupabaseUser = require("../middleware/requireSupabaseUser");
const {
    createFarm,
    getClimateHistory,
    getFarms,
    saveNasaClimateObservations,
    updateFarm
} = require("../controllers/farmController");

const router = express.Router();

router.use(requireSupabaseUser);
router.route("/")
    .post(createFarm)
    .get(getFarms);
router.patch("/:farmId", updateFarm);
router.post("/:farmId/climate-observations/nasa", saveNasaClimateObservations);
router.get("/:farmId/climate-observations", getClimateHistory);

module.exports = router;
