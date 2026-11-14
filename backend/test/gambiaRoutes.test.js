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
