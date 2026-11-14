const express = require("express");
const cors = require("cors");
const net = require("node:net");
const { config } = require("./config");
const healthRoutes = require("./routes/healthRoutes");
const databaseRoutes = require("./routes/databaseRoutes");
const nasaRoutes = require("./routes/nasaRoutes");
const gambiaRoutes = require("./routes/gambiaRoutes");
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
                nasaPowerDaily: "/api/nasa/power/daily",
                gambiaRegion: "/api/gambia",
                gambiaSources: "/api/gambia/sources",
                gambiaSummary: "/api/gambia/summary",
                gambiaSourceData: "/api/gambia/data/:sourceId"
            }
        });
    });
    app.use("/api/health", healthRoutes);
    app.use("/api/health/database", databaseRoutes);
    app.use("/api/nasa", nasaRoutes);
    app.use("/api/gambia", gambiaRoutes);
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