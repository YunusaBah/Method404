const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { databaseService } = require("../src/services/databaseService");
const { nasaPowerService } = require("../src/services/nasaPowerService");

process.env.CORS_ORIGINS = "http://localhost:5173";
process.env.NODE_ENV = "test";

const app = require("../src/server");

let server;
let baseUrl;

before(async () => {
    server = app.listen(0);
    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
});

test("GET / returns the FarmShift welcome response", async () => {
    const response = await fetch(`${baseUrl}/`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        message: "Welcome to FarmShift AI",
        team: "METHOD404"
    });
});

test("GET /api/health returns the existing health response", async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        success: true,
        message: "METHOD404 FarmShift AI API is running!",
        project: "FarmShift AI",
        team: "METHOD404"
    });
});

test("GET /api lists available API endpoints", async () => {
    const response = await fetch(`${baseUrl}/api`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
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
            gambiaSummary: "/api/gambia/summary",
            gambiaRecommendations: "/api/gambia/recommendations",
            gambiaRotation: "/api/gambia/rotation",
            engineDistricts: "/api/gambia/engine/districts",
            enginePlan: "/api/gambia/engine/plan",
            engineSlotOptions: "/api/gambia/engine/slot-options",
            gambiaSourceData: "/api/gambia/data/:sourceId",
            recommend: "/api/recommend?lat=13.45&lon=-16.58",
            weather: "/api/weather?lat=13.45&lon=-16.58",
            places: "/api/places?q=kerewan"
        }
    });
});

test("GET /api/health/supabase returns an explicit unavailable result on failure", async (t) => {
    const originalCheckConnection = databaseService.checkConnection;
    databaseService.checkConnection = async () => {
        throw Object.assign(new Error("Supabase is not configured."), {
            code: "SUPABASE_CONFIGURATION_MISSING"
        });
    };
    t.after(() => {
        databaseService.checkConnection = originalCheckConnection;
    });

    const response = await fetch(`${baseUrl}/api/health/supabase`);

    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.supabase, "unavailable");
    assert.equal(body.code, "SUPABASE_CONFIGURATION_MISSING");
    assert.equal(body.message, "Supabase is not configured.");
});

test("farm routes require a Supabase access token", async () => {
    const response = await fetch(`${baseUrl}/api/farms`);

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
        success: false,
        error: {
            code: "AUTHENTICATION_REQUIRED",
            message: "A Supabase access token is required."
        },
        message: "A Supabase access token is required."
    });
});

test("health endpoint allows the configured local frontend origin", async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: "http://localhost:5173" }
    });

    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
});

test("health endpoint allows an alternate local Vite port during development", async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: "http://localhost:5174" }
    });

    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5174");
});

test("health endpoint does not grant CORS access to an unknown origin", async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: "https://untrusted.example" }
    });

    assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("NASA POWER endpoint rejects invalid coordinates before contacting the upstream API", async () => {
    const response = await fetch(
        `${baseUrl}/api/nasa/power/daily?latitude=91&longitude=-16.58&start=20240101&end=20240103&parameters=T2M`
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
        success: false,
        error: {
            code: "INVALID_LATITUDE",
            message: "latitude must be a number between -90 and 90."
        },
        message: "latitude must be a number between -90 and 90."
    });
});

test("NASA POWER observation and summary routes validate query parameters", async () => {
    const invalidCoordinate = await fetch(
        `${baseUrl}/api/nasa/power?latitude=91&longitude=-16.58&start=20240101&end=20240103`
    );
    assert.equal(invalidCoordinate.status, 400);
    assert.equal((await invalidCoordinate.json()).error.code, "INVALID_LATITUDE");

    const invalidDate = await fetch(
        `${baseUrl}/api/nasa/power/summary?latitude=13.45&longitude=-16.58&start=20240230&end=20240301`
    );
    assert.equal(invalidDate.status, 400);
    assert.equal((await invalidDate.json()).error.code, "INVALID_START_DATE");
});

test("NASA POWER summary endpoint returns clearly marked derived summaries", async (t) => {
    const originalGetSummary = nasaPowerService.getSummary;
    nasaPowerService.getSummary = async () => ({
        source: "NASA POWER Daily API",
        attribution: "NASA Langley Research Center POWER Project",
        request: { latitude: 13.45, longitude: -16.58, start: "20240101", end: "20240103" },
        metadata: { returnedDateCount: 3 },
        summaries: { averageTemperature: { value: 25, unit: "C", derivedFrom: "T2M" } },
        observations: [{ date: "2024-01-01", parameter: "T2M", value: 25, unit: "C", missing: false }]
    });
    t.after(() => {
        nasaPowerService.getSummary = originalGetSummary;
    });

    const response = await fetch(
        `${baseUrl}/api/nasa/power/summary?latitude=13.45&longitude=-16.58&start=20240101&end=20240103`
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.source, "NASA POWER Daily API");
    assert.equal(body.summaries.averageTemperature.derivedFrom, "T2M");
    assert.equal(body.observations[0].value, 25);
});
