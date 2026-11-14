const { ApiError } = require("../../middleware/apiError");

/**
 * Fetches JSON from an upstream data provider and converts every failure into
 * an ApiError whose code is prefixed with the source id (for example
 * `MODIS_TIMEOUT`). Upstream error bodies are not forwarded to clients.
 */
async function fetchJson(url, {
    source,
    label,
    fetchImpl = globalThis.fetch,
    timeoutMs = 20_000,
    method = "GET",
    headers = {},
    body,
    retries = 0
} = {}) {
    const prefix = source.toUpperCase();
    let response;
    try {
        response = await fetchImpl(url, {
            method,
            headers: { Accept: "application/json", ...headers },
            body,
            signal: AbortSignal.timeout(timeoutMs)
        });
    } catch (error) {
        if (error.name === "TimeoutError" || error.name === "AbortError") {
            throw new ApiError(504, `${prefix}_TIMEOUT`, `${label} did not respond before the request timed out.`);
        }
        throw new ApiError(502, `${prefix}_UNAVAILABLE`, `${label} could not be reached.`);
    }

    if (!response.ok) {
        // Some providers return transient gateway errors under load.
        if (retries > 0 && [502, 503, 504].includes(response.status)) {
            return fetchJson(url, { source, label, fetchImpl, timeoutMs, method, headers, body, retries: retries - 1 });
        }
        throw new ApiError(502, `${prefix}_ERROR`, `${label} returned HTTP ${response.status}.`);
    }

    try {
        return await response.json();
    } catch {
        throw new ApiError(502, `${prefix}_INVALID_RESPONSE`, `${label} returned an invalid response.`);
    }
}

/**
 * In-memory, process-local cache with request de-duplication: concurrent calls
 * for the same key share one upstream request, and failures are not cached.
 */
function createCache({ ttlMs, maxEntries = 200, now = Date.now }) {
    const entries = new Map();
    const inFlight = new Map();

    return async function cached(key, load) {
        const hit = entries.get(key);
        if (hit && hit.expiresAt > now()) {
            return hit.value;
        }
        entries.delete(key);
        if (inFlight.has(key)) {
            return inFlight.get(key);
        }

        const pending = Promise.resolve().then(load).then((value) => {
            entries.set(key, { value, expiresAt: now() + ttlMs });
            if (entries.size > maxEntries) {
                entries.delete(entries.keys().next().value);
            }
            return value;
        });
        inFlight.set(key, pending);
        try {
            return await pending;
        } finally {
            inFlight.delete(key);
        }
    };
}

module.exports = { createCache, fetchJson };
