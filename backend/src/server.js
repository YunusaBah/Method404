const express = require("express");
const cors = require("cors");
const net = require("node:net");
require("dotenv").config();
const healthRoutes = require("./routes/healthRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

function isLocalDevelopmentOrigin(origin) {
    if (process.env.NODE_ENV === "production") {
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

app.use(cors({
    origin: (origin, callback) => {
        callback(null, !origin || allowedOrigins.includes(origin) || isLocalDevelopmentOrigin(origin));
    }
}));
app.use(express.json());

const PORT = process.env.PORT || 5000;

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

app.get("/", (req, res) => {
    res.json({
        message: "Welcome to FarmShift AI",
        team: "METHOD404"
    });
});

app.use("/api/health", healthRoutes);
app.use(errorHandler);

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