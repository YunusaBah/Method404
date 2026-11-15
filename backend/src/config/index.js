const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

class ConfigurationError extends Error {
    constructor(message) {
        super(`Invalid backend configuration: ${message}`);
        this.name = "ConfigurationError";
    }
}

function parseOrigin(value, name) {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new ConfigurationError(`${name} must contain a valid origin URL.`);
    }

    if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
    ) {
        throw new ConfigurationError(`${name} must be an HTTP(S) origin without a path.`);
    }

    return url.origin;
}

function parseUrl(value, name, {
    httpsOnly = false,
    allowCredentials = false,
    protocols = ["http:", "https:"]
} = {}) {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new ConfigurationError(`${name} must be a valid URL.`);
    }

    if (
        !protocols.includes(url.protocol) ||
        (httpsOnly && url.protocol !== "https:") ||
        (!allowCredentials && (url.username || url.password))
    ) {
        throw new ConfigurationError(`${name} must use an allowed URL protocol and contain no credentials.`);
    }

    return url.toString().replace(/\/$/, "");
}

function loadConfig(env = process.env) {
    const nodeEnv = env.NODE_ENV || "development";
    if (!["development", "test", "production"].includes(nodeEnv)) {
        throw new ConfigurationError("NODE_ENV must be development, test, or production.");
    }

    const port = Number(env.PORT || 5000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new ConfigurationError("PORT must be an integer between 1 and 65535.");
    }

    if (nodeEnv === "production" && !env.CLIENT_URL) {
        throw new ConfigurationError("CLIENT_URL must be set in production.");
    }
    if (nodeEnv === "production" && !env.CORS_ORIGINS) {
        throw new ConfigurationError("CORS_ORIGINS must be set in production.");
    }

    const clientUrl = parseOrigin(env.CLIENT_URL || "http://localhost:5173", "CLIENT_URL");
    const allowedOrigins = (env.CORS_ORIGINS || clientUrl)
        .split(",")
        .map((origin) => parseOrigin(origin.trim(), "CORS_ORIGINS"));

    if (new Set(allowedOrigins).size !== allowedOrigins.length) {
        throw new ConfigurationError("CORS_ORIGINS must not contain duplicate origins.");
    }
    if (!allowedOrigins.includes(clientUrl)) {
        throw new ConfigurationError("CORS_ORIGINS must include CLIENT_URL.");
    }
    if (
        nodeEnv === "production" &&
        allowedOrigins.some((origin) => new URL(origin).hostname === "localhost" ||
            new URL(origin).hostname === "127.0.0.1" ||
            new URL(origin).hostname === "[::1]")
    ) {
        throw new ConfigurationError("CORS_ORIGINS must not contain localhost origins in production.");
    }

    const nasaPowerBaseUrl = parseUrl(
        env.NASA_POWER_BASE_URL || "https://power.larc.nasa.gov/api/temporal/daily/point",
        "NASA_POWER_BASE_URL",
        { httpsOnly: nodeEnv === "production" }
    );
    const supabaseUrl = env.SUPABASE_URL
        ? parseUrl(env.SUPABASE_URL, "SUPABASE_URL", { httpsOnly: nodeEnv === "production" })
        : "";
    // NASA Earthdata Login tokens are JSON Web Tokens (three dot-separated parts).
    const earthdataToken = (env.EARTHDATA_TOKEN || "").trim();
    if (earthdataToken && !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(earthdataToken)) {
        throw new ConfigurationError("EARTHDATA_TOKEN must be a NASA Earthdata Login token.");
    }
    return Object.freeze({
        port,
        nodeEnv,
        clientUrl,
        allowedOrigins: Object.freeze(allowedOrigins),
        nasaPowerBaseUrl,
        earthdata: Object.freeze({ token: earthdataToken }),
        supabase: Object.freeze({
            url: supabaseUrl,
            publishableKey: env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "",
            secretKey: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || ""
        })
    });
}

const config = loadConfig();

module.exports = { ConfigurationError, config, loadConfig };
