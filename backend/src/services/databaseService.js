const { createClient } = require("@supabase/supabase-js");
const { config } = require("../config");
const { ApiError } = require("../middleware/apiError");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function configurationError(variable) {
    return new ApiError(
        503,
        "SUPABASE_CONFIGURATION_MISSING",
        `Supabase is not configured. Set ${variable} in backend/.env.`
    );
}

function queryError() {
    return new ApiError(
        502,
        "SUPABASE_QUERY_FAILED",
        "Supabase could not complete the database operation."
    );
}

function unwrap(result) {
    if (result.error) {
        throw queryError();
    }
    return result.data;
}

function validateFarmId(farmId) {
    if (typeof farmId !== "string" || !UUID_PATTERN.test(farmId)) {
        throw new ApiError(400, "INVALID_FARM_ID", "farmId must be a valid UUID.");
    }
}

function validateFarmFields(fields, { creating = false } = {}) {
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
        throw new ApiError(400, "INVALID_FARM", "Farm information must be a JSON object.");
    }

    const allowed = new Set([
        "farm_name",
        "latitude",
        "longitude",
        "location",
        "farm_size_hectares"
    ]);
    if (Object.keys(fields).some((key) => !allowed.has(key))) {
        throw new ApiError(400, "INVALID_FARM", "Farm information contains unsupported fields.");
    }
    if (creating && (!Object.hasOwn(fields, "farm_name") ||
        !Object.hasOwn(fields, "latitude") || !Object.hasOwn(fields, "longitude"))) {
        throw new ApiError(
            400,
            "INVALID_FARM",
            "farm_name, latitude, and longitude are required."
        );
    }
    if (Object.keys(fields).length === 0) {
        throw new ApiError(400, "INVALID_FARM", "At least one farm field must be provided.");
    }

    const normalized = { ...fields };
    if (Object.hasOwn(fields, "farm_name")) {
        if (typeof fields.farm_name !== "string" ||
            fields.farm_name.trim().length === 0 ||
            fields.farm_name.trim().length > 200) {
            throw new ApiError(400, "INVALID_FARM_NAME", "farm_name must contain 1 to 200 characters.");
        }
        normalized.farm_name = fields.farm_name.trim();
    }
    for (const coordinate of ["latitude", "longitude"]) {
        if (Object.hasOwn(fields, coordinate)) {
            const value = Number(fields[coordinate]);
            const maximum = coordinate === "latitude" ? 90 : 180;
            if (fields[coordinate] === "" || !Number.isFinite(value) ||
                value < -maximum || value > maximum) {
                throw new ApiError(
                    400,
                    `INVALID_${coordinate.toUpperCase()}`,
                    `${coordinate} must be a number between -${maximum} and ${maximum}.`
                );
            }
            normalized[coordinate] = value;
        }
    }
    if (Object.hasOwn(fields, "location") &&
        (fields.location !== null &&
            (typeof fields.location !== "string" || fields.location.length > 500))) {
        throw new ApiError(400, "INVALID_LOCATION", "location must be a string of at most 500 characters or null.");
    }
    if (Object.hasOwn(fields, "farm_size_hectares") &&
        (fields.farm_size_hectares !== null &&
            (!Number.isFinite(Number(fields.farm_size_hectares)) ||
                Number(fields.farm_size_hectares) < 0))) {
        throw new ApiError(
            400,
            "INVALID_FARM_SIZE",
            "farm_size_hectares must be a non-negative number or null."
        );
    }
    if (Object.hasOwn(fields, "farm_size_hectares") && fields.farm_size_hectares !== null) {
        normalized.farm_size_hectares = Number(fields.farm_size_hectares);
    }

    return normalized;
}

function validateDate(value, field) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new ApiError(400, "INVALID_DATE", `${field} must be a date in YYYY-MM-DD format.`);
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new ApiError(400, "INVALID_DATE", `${field} must be a valid calendar date.`);
    }
}

function createDatabaseService({
    supabaseUrl = config.supabase.url,
    secretKey = config.supabase.secretKey,
    publishableKey = config.supabase.publishableKey,
    createClientImpl = createClient
} = {}) {
    let adminClient;

    function getAdminClient() {
        if (!supabaseUrl) {
            throw configurationError("SUPABASE_URL");
        }
        if (!secretKey) {
            throw configurationError("SUPABASE_SECRET_KEY");
        }
        if (!adminClient) {
            adminClient = createClientImpl(supabaseUrl, secretKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            });
        }
        return adminClient;
    }

    async function getAuthenticatedClient(accessToken) {
        if (!supabaseUrl) {
            throw configurationError("SUPABASE_URL");
        }
        if (!publishableKey) {
            throw configurationError("SUPABASE_PUBLISHABLE_KEY");
        }
        if (typeof accessToken !== "string" || accessToken.length === 0) {
            throw new ApiError(401, "AUTHENTICATION_REQUIRED", "A Supabase access token is required.");
        }

        const client = createClientImpl(supabaseUrl, publishableKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            },
            global: {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        });
        const { data, error } = await client.auth.getUser(accessToken);
        if (error || !data?.user) {
            if (error && error.status !== 401 && error.status !== 403) {
                throw new ApiError(
                    503,
                    "SUPABASE_AUTH_UNAVAILABLE",
                    "Supabase Auth is temporarily unavailable."
                );
            }
            throw new ApiError(401, "INVALID_ACCESS_TOKEN", "A valid Supabase access token is required.");
        }
        return { client, user: data.user };
    }

    async function checkConnection() {
        let result;
        try {
            result = await getAdminClient().from("profiles").select("id").limit(1);
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(
                503,
                "SUPABASE_UNAVAILABLE",
                "Unable to connect to the configured Supabase project."
            );
        }
        if (result.error) {
            if (["PGRST205", "42P01"].includes(result.error.code)) {
                throw new ApiError(
                    503,
                    "SUPABASE_SCHEMA_NOT_READY",
                    "Supabase is reachable, but public.profiles is missing or not exposed. Apply the FarmShift migration."
                );
            }
            throw new ApiError(
                503,
                "SUPABASE_UNAVAILABLE",
                "Unable to connect to the configured Supabase project or read its profiles table."
            );
        }
        return true;
    }

    async function createFarm(client, ownerId, fields) {
        const farm = validateFarmFields(fields, { creating: true });
        return unwrap(await client
            .from("farms")
            .insert({ ...farm, owner_id: ownerId })
            .select("*")
            .single());
    }

    async function getFarms(client) {
        return unwrap(await client
            .from("farms")
            .select("*")
            .order("created_at", { ascending: false }));
    }

    async function getFarm(client, farmId) {
        validateFarmId(farmId);
        const farm = unwrap(await client
            .from("farms")
            .select("*")
            .eq("id", farmId)
            .maybeSingle());
        if (!farm) {
            throw new ApiError(404, "FARM_NOT_FOUND", "Farm not found.");
        }
        return farm;
    }

    async function updateFarm(client, farmId, fields) {
        validateFarmId(farmId);
        const farm = validateFarmFields(fields);
        const updated = unwrap(await client
            .from("farms")
            .update(farm)
            .eq("id", farmId)
            .select("*")
            .maybeSingle());
        if (!updated) {
            throw new ApiError(404, "FARM_NOT_FOUND", "Farm not found.");
        }
        return updated;
    }

    async function saveNasaClimateObservations(client, farmId, farm, nasaData) {
        validateFarmId(farmId);
        const parameters = nasaData?.properties?.parameter;
        if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
            throw new ApiError(502, "NASA_POWER_INVALID_RESPONSE", "NASA POWER returned no daily parameter data.");
        }

        const observations = [];
        for (const [parameter, dailyValues] of Object.entries(parameters)) {
            if (!dailyValues || typeof dailyValues !== "object" || Array.isArray(dailyValues)) {
                continue;
            }
            const unit = nasaData.parameters?.[parameter]?.units || null;
            for (const [date, rawValue] of Object.entries(dailyValues)) {
                if (!/^\d{8}$/.test(date)) {
                    continue;
                }
                const value = Number(rawValue);
                if (!Number.isFinite(value) || value === -999) {
                    continue;
                }
                observations.push({
                    farm_id: farmId,
                    source: "NASA_POWER",
                    parameter,
                    value,
                    unit,
                    observation_date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
                    latitude: farm.latitude,
                    longitude: farm.longitude
                });
            }
        }

        if (observations.length === 0) {
            return [];
        }
        return unwrap(await client
            .from("climate_observations")
            .upsert(observations, {
                onConflict: "farm_id,source,parameter,observation_date",
                ignoreDuplicates: false
            })
            .select("*"));
    }

    async function getClimateHistory(client, farmId, { start, end, limit = 1000 } = {}) {
        validateFarmId(farmId);
        if (start !== undefined) validateDate(start, "start");
        if (end !== undefined) validateDate(end, "end");
        if (start && end && start > end) {
            throw new ApiError(400, "INVALID_DATE_RANGE", "start must be on or before end.");
        }
        const parsedLimit = Number(limit);
        if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
            throw new ApiError(400, "INVALID_LIMIT", "limit must be an integer between 1 and 1000.");
        }

        let query = client
            .from("climate_observations")
            .select("*")
            .eq("farm_id", farmId)
            .order("observation_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(parsedLimit);
        if (start) query = query.gte("observation_date", start);
        if (end) query = query.lte("observation_date", end);
        return unwrap(await query);
    }

    return {
        checkConnection,
        createFarm,
        getAuthenticatedClient,
        getClimateHistory,
        getFarm,
        getFarms,
        saveNasaClimateObservations,
        updateFarm
    };
}

const databaseService = createDatabaseService();

module.exports = {
    createDatabaseService,
    databaseService,
    validateFarmFields
};
