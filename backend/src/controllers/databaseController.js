const { databaseService } = require("../services/databaseService");

async function getDatabaseHealth(req, res) {
    try {
        await databaseService.checkConnection();
        return res.status(200).json({
            success: true,
            database: "connected"
        });
    } catch {
        return res.status(503).json({
            success: false,
            database: "unavailable",
            message: "The database is not configured or is currently unavailable."
        });
    }
}

module.exports = { getDatabaseHealth };
