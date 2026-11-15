const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createDatabaseService, validateFarmFields } = require("../src/services/databaseService");

test("Supabase health check performs a profiles query with the backend secret key", async () => {
    let clientOptions;
    let requestedTable;
    let selectedColumns;
    let rowLimit;
    const service = createDatabaseService({
        supabaseUrl: "https://farmshift.supabase.co",
        publishableKey: "sb_publishable_public",
        secretKey: "sb_secret_backend",
        createClientImpl: (url, key, options) => {
            assert.equal(url, "https://farmshift.supabase.co");
            assert.equal(key, "sb_secret_backend");
            clientOptions = options;
            return {
                from(table) {
                    requestedTable = table;
                    return {
                        select(columns) {
                            selectedColumns = columns;
                            return {
                                async limit(value) {
                                    rowLimit = value;
                                    return { data: [], error: null };
                                }
                            };
                        }
                    };
                }
            };
        }
    });

    assert.equal(await service.checkConnection(), true);
    assert.equal(requestedTable, "profiles");
    assert.equal(selectedColumns, "id");
    assert.equal(rowLimit, 1);
    assert.equal(clientOptions.auth.persistSession, false);
});

test("Supabase health check fails explicitly when required project credentials are absent", async () => {
    const service = createDatabaseService({
        supabaseUrl: "",
        secretKey: "",
        createClientImpl: () => {
            throw new Error("Client must not be constructed.");
        }
    });

    await assert.rejects(service.checkConnection(), (error) => {
        assert.equal(error.code, "SUPABASE_CONFIGURATION_MISSING");
        assert.match(error.message, /SUPABASE_URL/);
        return true;
    });
});

test("Supabase health check reports query failures without returning backend details", async () => {
    const service = createDatabaseService({
        supabaseUrl: "https://farmshift.supabase.co",
        secretKey: "sb_secret_backend",
        createClientImpl: () => ({
            from: () => ({
                select: () => ({
                    limit: async () => ({
                        data: null,
                        error: { code: "PGRST205", message: "private database detail" }
                    })
                })
            })
        })
    });

    await assert.rejects(service.checkConnection(), (error) => {
        assert.equal(error.code, "SUPABASE_SCHEMA_NOT_READY");
        assert.match(error.message, /Supabase is reachable/);
        assert.doesNotMatch(error.message, /private database detail/);
        return true;
    });
});

test("user database clients use the publishable key and forward a verified user token", async () => {
    let clientOptions;
    let apiKey;
    const user = { id: "54b5ded2-25b8-4fad-8a3d-dd15a9718bf9" };
    const service = createDatabaseService({
        supabaseUrl: "https://farmshift.supabase.co",
        publishableKey: "sb_publishable_public",
        secretKey: "sb_secret_backend",
        createClientImpl: (url, key, options) => {
            apiKey = key;
            clientOptions = options;
            return {
                auth: {
                    async getUser(token) {
                        assert.equal(token, "verified-user-token");
                        return { data: { user }, error: null };
                    }
                }
            };
        }
    });

    const result = await service.getAuthenticatedClient("verified-user-token");

    assert.equal(result.user, user);
    assert.equal(apiKey, "sb_publishable_public");
    assert.equal(
        clientOptions.global.headers.Authorization,
        "Bearer verified-user-token"
    );
    assert.equal(clientOptions.auth.persistSession, false);
});

test("farm input validation accepts allowed fields and rejects owner overrides", () => {
    assert.deepEqual(validateFarmFields({
        farm_name: "  Lower River Farm  ",
        latitude: "13.45",
        longitude: "-16.58",
        farm_size_hectares: "2.5"
    }, { creating: true }), {
        farm_name: "Lower River Farm",
        latitude: 13.45,
        longitude: -16.58,
        farm_size_hectares: 2.5
    });
    assert.throws(() => validateFarmFields({
        farm_name: "Farm",
        latitude: 91,
        longitude: 0
    }, { creating: true }), /latitude must be/);
    assert.throws(() => validateFarmFields({
        farm_name: "Farm",
        latitude: 0,
        longitude: 0,
        owner_id: "attacker-controlled"
    }, { creating: true }), /unsupported fields/);
});

test("farm creation adds the authenticated owner and returns the inserted row", async () => {
    const ownerId = "54b5ded2-25b8-4fad-8a3d-dd15a9718bf9";
    const farm = {
        id: "c10dd3f7-c3f6-48aa-8540-758c12c8e139",
        farm_name: "River Farm",
        latitude: 13.45,
        longitude: -16.58,
        owner_id: ownerId
    };
    let inserted;
    const client = {
        from(table) {
            assert.equal(table, "farms");
            return {
                insert(values) {
                    inserted = values;
                    return {
                        select() {
                            return { single: async () => ({ data: farm, error: null }) };
                        }
                    };
                }
            };
        }
    };
    const service = createDatabaseService();

    assert.equal(await service.createFarm(client, ownerId, {
        farm_name: "River Farm",
        latitude: 13.45,
        longitude: -16.58
    }), farm);
    assert.deepEqual(inserted, {
        farm_name: "River Farm",
        latitude: 13.45,
        longitude: -16.58,
        owner_id: ownerId
    });
});

test("NASA observations are transformed into database rows and missing-value sentinels are skipped", async () => {
    const farmId = "c10dd3f7-c3f6-48aa-8540-758c12c8e139";
    const farm = { id: farmId, latitude: 13.45, longitude: -16.58 };
    let inserted;
    const client = {
        from(table) {
            assert.equal(table, "climate_observations");
            return {
                upsert(values, options) {
                    inserted = values;
                    assert.equal(options.onConflict, "farm_id,source,parameter,observation_date");
                    return {
                        select: async () => ({ data: values, error: null })
                    };
                }
            };
        }
    };
    const service = createDatabaseService();
    const rows = await service.saveNasaClimateObservations(client, farmId, farm, {
        parameters: { T2M: { units: "C" } },
        properties: {
            parameter: {
                T2M: {
                    "20240101": 24.5,
                    "20240102": -999
                }
            }
        }
    });

    assert.equal(rows.length, 1);
    assert.deepEqual(inserted, [{
        farm_id: farmId,
        source: "NASA_POWER",
        parameter: "T2M",
        value: 24.5,
        unit: "C",
        observation_date: "2024-01-01",
        latitude: 13.45,
        longitude: -16.58
    }]);
});
