const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

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
