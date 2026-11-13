const { getHealthStatus } = require("../services/healthService");

function getHealth(req, res, next) {
    try {
        res.status(200).json(getHealthStatus());
    } catch (error) {
        next(error);
    }
}

module.exports = { getHealth };
