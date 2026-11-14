const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadConfig } = require("../src/config");
const { createApp } = require("../src/server");
const { createDatabaseService } = require("../src/services/databaseService");

test("configuration supplies safe development defaults and leaves integrations optional", () => {
    const config = loadConfig({});

    assert.equal(config.port, 5000);
    assert.equal(config.nodeEnv, "development");
    assert.deepEqual(config.allowedOrigins, ["http://localhost:5173"]);
    assert.equal(config.supabase.serviceRoleKey, "");
    assert.equal(config.supabase.databaseUrl, "");
});

test("invalid port and unsupported environment fail with actionable messages", () => {
    assert.throws(() => loadConfig({ PORT: "70000" }), /PORT must be an integer/);
    assert.throws(() => loadConfig({ NODE_ENV: "staging" }), /NODE_ENV must be/);
});

test("production requires explicit origins and excludes localhost", () => {
    assert.throws(
        () => loadConfig({ NODE_ENV: "production" }),
        /CLIENT_URL must be set in production/
    );
    assert.throws(() => loadConfig({
        NODE_ENV: "production",
        CLIENT_URL: "http://localhost:5173",
        CORS_ORIGINS: "http://localhost:5173"
    }), /must not contain localhost/);
    assert.doesNotThrow(() => loadConfig({
        NODE_ENV: "production",
        CLIENT_URL: "https://farmshift.example",
        CORS_ORIGINS: "https://farmshift.example"
    }));
});

test("production CORS rejects unlisted origins with a safe error response", async (t) => {
    const app = createApp({
        nodeEnv: "production",
        allowedOrigins: ["https://farmshift.example"]
    });

    test("database service requires a connection string", async () => {
        const database = createDatabaseService({ connectionString: "" });

        await assert.rejects(database.checkConnection(), (error) => {
            assert.match(error.message, /Unable to connect to the configured PostgreSQL database/);
            assert.equal(error.code, "DATABASE_URL_MISSING");
            return true;
        });
    });

    test("database service verifies connectivity without exposing its connection string", async () => {
        let poolOptions;
        let query;
        const database = createDatabaseService({
            connectionString: "postgresql://user:private@example.test:5432/postgres",
            PoolClass: class {
                constructor(options) {
                    poolOptions = options;
                }

                on() {}

                async query(sql) {
                    query = sql;
                    return { rows: [{ "?column?": 1 }] };
                }

                async end() {}
            }
        });

        assert.equal(await database.checkConnection(), true);
        assert.equal(query, "SELECT 1");
        assert.equal(poolOptions.ssl.rejectUnauthorized, true);
        await database.close();
    });
    const server = app.listen(0);
    t.after(() => new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    }));
    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });

    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`, {
        headers: { Origin: "https://untrusted.example" }
    });

    assert.equal(response.status, 403);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.deepEqual(await response.json(), {
        success: false,
        error: {
            code: "CORS_ORIGIN_DENIED",
            message: "This origin is not allowed."
        },
        message: "This origin is not allowed."
    });
});
