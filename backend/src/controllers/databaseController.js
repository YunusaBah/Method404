const { databaseService } = require("../services/databaseService");

async function getDatabaseHealth(req, res) {
    try {
        await databaseService.checkConnection();
        return res.status(200).json({
            success: true,
            supabase: "connected"
        });
    } catch (error) {
        return res.status(503).json({
            success: false,
            supabase: "unavailable",
            code: error.code || "SUPABASE_UNAVAILABLE",
            message: error.message || "Unable to connect to the configured Supabase project."
        });
    }
}

module.exports = { getDatabaseHealth };
