const { Pool } = require("pg");
const { config } = require("../config");

class DatabaseConnectionError extends Error {
    constructor(code = "DATABASE_UNAVAILABLE") {
        super("Unable to connect to the configured PostgreSQL database.");
        this.name = "DatabaseConnectionError";
        this.code = code;
    }
}

function createDatabaseService({
    connectionString = config.supabase.databaseUrl,
    PoolClass = Pool
} = {}) {
    let pool;

    function getPool() {
        if (!connectionString) {
            throw new DatabaseConnectionError("DATABASE_URL_MISSING");
        }

        if (!pool) {
            pool = new PoolClass({
                connectionString,
                ssl: { rejectUnauthorized: true },
                max: 10,
                idleTimeoutMillis: 30_000,
                connectionTimeoutMillis: 5_000
            });
            pool.on("error", (error) => {
                console.error(`[database] Idle client error (${error.code || "unknown"}).`);
            });
        }

        return pool;
    }

    async function checkConnection() {
        try {
            await getPool().query("SELECT 1");
            return true;
        } catch (error) {
            throw new DatabaseConnectionError(error.code || "DATABASE_UNAVAILABLE");
        }
    }

    async function close() {
        if (pool) {
            const activePool = pool;
            pool = undefined;
            await activePool.end();
        }
    }

    return { checkConnection, close };
}

const databaseService = createDatabaseService();

module.exports = { createDatabaseService, databaseService, DatabaseConnectionError };
