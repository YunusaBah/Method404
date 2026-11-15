const { weatherService } = require("../services/weatherService");

async function getWeather(req, res, next) {
    try {
        const data = await weatherService.getWeather(req.query);
        return res.status(200).json(data);
    } catch (error) {
        return next(error);
    }
}

module.exports = { getWeather };
