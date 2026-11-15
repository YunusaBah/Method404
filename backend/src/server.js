const express = require("express");
const cors = require("cors");
const net = require("node:net");
const { config } = require("./config");
const healthRoutes = require("./routes/healthRoutes");
const databaseRoutes = require("./routes/databaseRoutes");
const farmRoutes = require("./routes/farmRoutes");
const nasaRoutes = require("./routes/nasaRoutes");
const gambiaRoutes = require("./routes/gambiaRoutes");
const recommendRoutes = require("./routes/recommendRoutes");
const placeRoutes = require("./routes/placeRoutes");
const weatherRoutes = require("./routes/weatherRoutes");
const cropRoutes = require("./routes/cropRoutes");
const errorHandler = require("./middleware/errorHandler");

function isLocalDevelopmentOrigin(origin, nodeEnv) {
    if (nodeEnv === "production") {
        return false;
    }

    try {
        const url = new URL(origin);
        return url.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    } catch {
        return false;
    }
}

function createApp(appConfig = config) {
    const app = express();

    app.use(cors({
        origin: (origin, callback) => {
            if (
                !origin ||
                appConfig.allowedOrigins.includes(origin) ||
                isLocalDevelopmentOrigin(origin, appConfig.nodeEnv)
            ) {
                return callback(null, true);
            }
            if (appConfig.nodeEnv === "production") {
                return callback(new Error("Origin is not allowed by CORS."));
            }
            return callback(null, false);
        }
    }));
    app.use(express.json());
    app.get("/", (req, res) => {
        res.json({
            message: "Welcome to FarmShift AI",
            team: "METHOD404"
        });
    });
    app.get("/api", (req, res) => {
        res.json({
            success: true,
            message: "FarmShift AI API",
            endpoints: {
                health: "/api/health",
                databaseHealth: "/api/health/database",
                supabaseHealth: "/api/health/supabase",
                farms: "/api/farms",
                nasaPowerDaily: "/api/nasa/power/daily",
                gambiaRegion: "/api/gambia",
                gambiaSources: "/api/gambia/sources",
                gambiaCrops: "/api/gambia/crops",
                gambiaCropPrediction: "/api/gambia/crops/:crop/prediction",
                gambiaSummary: "/api/gambia/summary",
                gambiaRecommendations: "/api/gambia/recommendations",
                gambiaRotation: "/api/gambia/rotation",
                engineDistricts: "/api/gambia/engine/districts",
                enginePlan: "/api/gambia/engine/plan",
                engineSlotOptions: "/api/gambia/engine/slot-options",
                gambiaSourceData: "/api/gambia/data/:sourceId",
                recommend: "/api/recommend?lat=13.45&lon=-16.58",
                weather: "/api/weather?lat=13.45&lon=-16.58",
                places: "/api/places?q=kerewan",
                crops: "/api/crops"
            }
        });
    });
    app.use("/api/health", healthRoutes);
    app.use("/api/health/database", databaseRoutes);
    app.use("/api/farms", farmRoutes);
    app.use("/api/nasa", nasaRoutes);
    app.use("/api/gambia", gambiaRoutes);
    app.use("/api/recommend", recommendRoutes);
    app.use("/api/places", placeRoutes);
    app.use("/api/weather", weatherRoutes);
    app.use("/api/crops", cropRoutes);
    app.use(errorHandler);

    return app;
}

const app = createApp();
const PORT = config.port;

function assertPortAvailable(port) {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: "127.0.0.1", port: Number(port) });
        let settled = false;

        function finish(error) {
            if (settled) return;
            settled = true;
            socket.destroy();
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        }

        socket.setTimeout(300);
        socket.once("connect", () => {
            finish(new Error(`Port ${port} is already in use. Set PORT to an available port.`));
        });
        socket.once("timeout", () => {
            finish(new Error(`Port ${port} did not respond to an availability check.`));
        });
        socket.once("error", (error) => {
            if (error.code === "ECONNREFUSED") {
                finish();
            } else {
                finish(error);
            }
        });
    });
}

if (require.main === module) {
    assertPortAvailable(PORT)
        .then(() => {
            const server = app.listen(PORT, () => {
                console.log(`FarmShift API running on port ${PORT}`);
            });
            server.on("error", (error) => {
                console.error(`[backend] Failed to listen on port ${PORT}: ${error.message}`);
                process.exitCode = 1;
            });
        })
        .catch((error) => {
            console.error(`[backend] ${error.message}`);
            process.exitCode = 1;
        });
}

module.exports = app;
module.exports.createApp = createApp;