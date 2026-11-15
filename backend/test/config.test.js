const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadConfig } = require("../src/config");
const { createApp } = require("../src/server");

test("configuration supplies safe development defaults and leaves integrations optional", () => {
    const config = loadConfig({});

    assert.equal(config.port, 5000);
    assert.equal(config.nodeEnv, "development");
    assert.deepEqual(config.allowedOrigins, ["http://localhost:5173"]);
    assert.equal(config.supabase.url, "");
    assert.equal(config.supabase.publishableKey, "");
    assert.equal(config.supabase.secretKey, "");
});

test("configuration reads the backend Supabase URL and keys", () => {
    const config = loadConfig({
        SUPABASE_URL: "https://farmshift.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        SUPABASE_SECRET_KEY: "sb_secret_test"
    });

    assert.equal(config.supabase.url, "https://farmshift.supabase.co");
    assert.equal(config.supabase.publishableKey, "sb_publishable_test");
    assert.equal(config.supabase.secretKey, "sb_secret_test");
});

test("legacy Supabase keys remain supported as a compatibility fallback", () => {
    const config = loadConfig({
        SUPABASE_URL: "https://farmshift.supabase.co",
        SUPABASE_ANON_KEY: "legacy-publishable",
        SUPABASE_SERVICE_ROLE_KEY: "legacy-secret"
    });

    assert.equal(config.supabase.publishableKey, "legacy-publishable");
    assert.equal(config.supabase.secretKey, "legacy-secret");
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

test("Earthdata token is optional and must look like an Earthdata Login token", () => {
    assert.equal(loadConfig({}).earthdata.token, "");
    assert.equal(loadConfig({ EARTHDATA_TOKEN: " aaa.bbb.ccc " }).earthdata.token, "aaa.bbb.ccc");
    assert.throws(() => loadConfig({ EARTHDATA_TOKEN: "my password" }), /EARTHDATA_TOKEN must be/);
});
