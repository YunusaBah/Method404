const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

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
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("GET /api/gambia returns the region and its reference locations", async () => {
    const response = await fetch(`${baseUrl}/api/gambia`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.country, "The Gambia");
    assert.equal(body.defaultLocation, "janjanbureh");
    assert.equal(body.locations.length, 7);
});

test("GET /api/gambia/sources lists every data source", async () => {
    const response = await fetch(`${baseUrl}/api/gambia/sources`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.sources.length, 13);
});

test("source data requests outside The Gambia are rejected before any upstream call", async () => {
    const response = await fetch(`${baseUrl}/api/gambia/data/power?latitude=14.69&longitude=-17.44`);
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, "LOCATION_OUTSIDE_GAMBIA");
});

test("unknown sources return 404", async () => {
    const response = await fetch(`${baseUrl}/api/gambia/data/weather`);

    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, "UNKNOWN_SOURCE");
});

test("recommendations reject locations outside The Gambia", async () => {
    const response = await fetch(`${baseUrl}/api/gambia/recommendations?latitude=14.69&longitude=-17.44`);

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "LOCATION_OUTSIDE_GAMBIA");
});

test("rotation validates its options before any upstream call", async () => {
    const years = await fetch(`${baseUrl}/api/gambia/rotation?years=9`);
    const previous = await fetch(`${baseUrl}/api/gambia/rotation?previous=wheat`);

    assert.equal(years.status, 400);
    assert.equal((await years.json()).error.code, "INVALID_YEARS");
    assert.equal(previous.status, 400);
    assert.equal((await previous.json()).error.code, "INVALID_PREVIOUS_CROP");
});

test("engine endpoints list districts and answer incomplete profiles without upstream calls", async () => {
    const districts = await (await fetch(`${baseUrl}/api/gambia/engine/districts`)).json();
    assert.equal(districts.districts.length, 8);

    const plan = await fetch(`${baseUrl}/api/gambia/engine/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: { cellId: "basse", soil: "unknown", water: "rainfed" }, scenario: {}, fixed: {} })
    });
    assert.equal(plan.status, 200);
    assert.deepEqual(await plan.json(), { status: "insufficient", missing: ["soil"] });

    const invalid = await fetch(`${baseUrl}/api/gambia/engine/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: { cellId: "dakar", soil: "sandy", water: "rainfed" } })
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "UNKNOWN_DISTRICT");
});
