const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
    createNasaPowerService,
    SUPPORTED_PARAMETERS,
    validateRequest
} = require("../src/services/nasaPowerService");

const request = {
    latitude: "13.45",
    longitude: "-16.58",
    start: "20240101",
    end: "20240103",
    parameters: "T2M,PRECTOTCORR"
};
const nasaPayload = {
    header: { title: "NASA/POWER Source Native Data", fill_value: -999 },
    messages: ["Daily data"],
    parameters: {
        T2M: { units: "C", longname: "Temperature at 2 Meters" },
        T2M_MAX: { units: "C" },
        T2M_MIN: { units: "C" },
        PRECTOTCORR: { units: "mm/day" },
        RH2M: { units: "%" },
        ALLSKY_SFC_SW_DWN: { units: "MJ/m^2/day" }
    },
    properties: {
        parameter: {
            T2M: { "20240101": 25, "20240102": -999, "20240103": 27 },
            T2M_MAX: { "20240101": 31, "20240102": 32, "20240103": 30 },
            T2M_MIN: { "20240101": 19, "20240102": 20, "20240103": 18 },
            PRECTOTCORR: { "20240101": 0.5, "20240102": -999, "20240103": 2 },
            RH2M: { "20240101": 70, "20240102": 80, "20240103": 75 },
            ALLSKY_SFC_SW_DWN: { "20240101": 20, "20240102": 21, "20240103": 19 }
        }
    }
};

test("validates coordinates, dates, parameters, and community before requesting NASA", () => {
    assert.equal(validateRequest(request).latitude, 13.45);
    assert.equal(validateRequest(request).community, "AG");
    assert.deepEqual(validateRequest({ ...request, parameters: undefined }).parameters, SUPPORTED_PARAMETERS);
    assert.throws(() => validateRequest({ ...request, latitude: "91" }), /latitude must be/);
    assert.throws(() => validateRequest({ ...request, latitude: " " }), /latitude must be/);
    assert.throws(() => validateRequest({ ...request, start: "20240230" }), /valid date/);
    assert.throws(() => validateRequest({ ...request, start: "20240104" }), /on or before/);
    assert.throws(() => validateRequest({ ...request, parameters: "T2M,INVALID VALUE" }), /supported NASA POWER parameters/);
    assert.throws(() => validateRequest({ ...request, parameters: "T2M,UNKNOWN" }), /supported NASA POWER parameters/);
    assert.throws(() => validateRequest({ ...request, community: "XX" }), /community must be/);
});

test("requests every supported NASA parameter by default and normalizes metadata and missing values", async () => {
    let requestedUrl;
    const service = createNasaPowerService({
        baseUrl: "https://power.larc.nasa.gov/api/temporal/daily/point",
        fetchImpl: async (url) => {
            requestedUrl = new URL(url);
            return Response.json(nasaPayload);
        }
    });

    const data = await service.getObservations({
        latitude: "13.45",
        longitude: "-16.58",
        start: "20240101",
        end: "20240103"
    });

    assert.equal(requestedUrl.searchParams.get("parameters"), SUPPORTED_PARAMETERS.join(","));
    assert.equal(requestedUrl.searchParams.get("community"), "AG");
    assert.equal(requestedUrl.searchParams.get("format"), "JSON");
    assert.deepEqual(data.metadata.header, nasaPayload.header);
    assert.deepEqual(data.metadata.messages, nasaPayload.messages);
    assert.equal(data.request.latitude, 13.45);
    assert.equal(data.observations.length, 18);
    assert.deepEqual(data.observations.find((item) =>
        item.parameter === "T2M" && item.date === "2024-01-02"
    ), {
        date: "2024-01-02",
        parameter: "T2M",
        value: null,
        unit: "C",
        missing: true,
        missingValue: -999
    });
    assert.equal(data.observations.find((item) => item.parameter === "PRECTOTCORR").unit, "mm/day");
});

test("derives summaries from available daily values without filling missing observations", async () => {
    const service = createNasaPowerService({
        fetchImpl: async () => Response.json(nasaPayload)
    });
    const summary = await service.getSummary(request);

    assert.equal(summary.summaries.averageTemperature.value, 26);
    assert.equal(summary.summaries.maximumTemperature.value, 32);
    assert.equal(summary.summaries.minimumTemperature.value, 18);
    assert.equal(summary.summaries.totalPrecipitation.value, 2.5);
    assert.equal(summary.summaries.totalPrecipitation.unit, "mm");
    assert.equal(summary.summaries.averageRelativeHumidity.value, 75);
    assert.equal(summary.summaries.averageSolarRadiation.value, 20);
    assert.equal(summary.summaries.averageTemperature.derivedFrom, "T2M");
    assert.equal(summary.observations.find((item) =>
        item.parameter === "PRECTOTCORR" && item.date === "2024-01-02"
    ).value, null);
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

test("does not cache failed upstream responses", async () => {
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

test("rejects malformed NASA responses without caching them", async () => {
    let requestCount = 0;
    const service = createNasaPowerService({
        fetchImpl: async () => {
            requestCount += 1;
            return Response.json({ error: "unexpected payload" });
        }
    });

    await assert.rejects(service.getDailyPointData(request), /NASA POWER returned an unexpected response/);
    await assert.rejects(service.getDailyPointData(request), /NASA POWER returned an unexpected response/);
    assert.equal(requestCount, 2);
});

test("maps NASA POWER request timeouts to a gateway timeout", async () => {
    const service = createNasaPowerService({
        fetchImpl: async () => {
            throw Object.assign(new Error("request timed out"), { name: "TimeoutError" });
        }
    });

    await assert.rejects(service.getDailyPointData(request), (error) => {
        assert.equal(error.statusCode, 504);
        assert.equal(error.code, "NASA_POWER_TIMEOUT");
        return true;
    });
});

test("accepts soil wetness parameters on request without adding them to the default set", () => {
    const requested = validateRequest({ ...request, parameters: "T2M,GWETTOP,GWETROOT" }).parameters;

    assert.deepEqual(requested, ["T2M", "GWETTOP", "GWETROOT"]);
    assert.equal(SUPPORTED_PARAMETERS.includes("GWETROOT"), false);
});
