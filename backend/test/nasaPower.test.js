const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createNasaPowerService, validateRequest } = require("../src/services/nasaPowerService");

const request = {
    latitude: "13.45",
    longitude: "-16.58",
    start: "20240101",
    end: "20240103",
    parameters: "T2M,PRECTOTCORR"
};
const nasaPayload = { properties: { parameter: { T2M: {} } } };

test("validates coordinates, dates, parameters, and community before requesting NASA", () => {
    assert.equal(validateRequest(request).latitude, 13.45);
    assert.equal(validateRequest(request).community, "AG");
    assert.throws(() => validateRequest({ ...request, latitude: "91" }), /latitude must be/);
    assert.throws(() => validateRequest({ ...request, start: "20240230" }), /valid date/);
    assert.throws(() => validateRequest({ ...request, start: "20240104" }), /on or before/);
    assert.throws(() => validateRequest({ ...request, parameters: "T2M,INVALID VALUE" }), /parameter names/);
    assert.throws(() => validateRequest({ ...request, community: "XX" }), /community must be/);
});

test("builds the NASA POWER request and caches successful response data", async () => {
    let requestCount = 0;
    let requestedUrl;
    const service = createNasaPowerService({
        baseUrl: "https://power.larc.nasa.gov/api/temporal/daily/point",
        fetchImpl: async (url) => {
            requestCount += 1;
            requestedUrl = new URL(url);
            return Response.json(nasaPayload);
        }
    });

    const [first, second] = await Promise.all([
        service.getDailyPointData(request),
        service.getDailyPointData(request)
    ]);

    assert.deepEqual(first, nasaPayload);
    assert.deepEqual(second, nasaPayload);
    assert.equal(requestCount, 1);
    assert.equal(requestedUrl.searchParams.get("parameters"), "T2M,PRECTOTCORR");
    assert.equal(requestedUrl.searchParams.get("format"), "JSON");
    assert.equal(requestedUrl.searchParams.get("community"), "AG");
});

test("does not cache failed or malformed upstream responses", async () => {
    let requestCount = 0;
    const service = createNasaPowerService({
        fetchImpl: async () => {
            requestCount += 1;
            return Response.json({ error: "upstream error" }, { status: 503 });
        }
    });

    await assert.rejects(service.getDailyPointData(request), /NASA POWER returned HTTP 503/);
    await assert.rejects(service.getDailyPointData(request), /NASA POWER returned HTTP 503/);
    assert.equal(requestCount, 2);
});
