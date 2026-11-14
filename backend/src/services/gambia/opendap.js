const { ApiError } = require("../../middleware/apiError");

/**
 * Reads a few grid cells from a NASA Earthdata file through the cloud OPeNDAP
 * service (opendap.earthdata.nasa.gov), so only the requested values are
 * transferred instead of the whole file.
 *
 * `variables` maps an output name to a DAP4 variable path and its index
 * ranges, for example { rain: "/precipitation[0:0][1652:1652][1035:1036]" }.
 * The service returns blank values when the last dimension has a single
 * element, so callers request two cells along it and the first is used.
 */
async function readOpendapCells(opendapUrl, variables, {
    source,
    token,
    fetchImpl = globalThis.fetch,
    timeoutMs = 30_000
}) {
    const prefix = source.toUpperCase().replaceAll("-", "_");
    const url = new URL(`${opendapUrl}.dap.csv`);
    url.searchParams.set("dap4.ce", Object.values(variables).join(";"));

    let response;
    try {
        response = await fetchImpl(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(timeoutMs)
        });
    } catch (error) {
        if (error.name === "TimeoutError" || error.name === "AbortError") {
            throw new ApiError(504, `${prefix}_TIMEOUT`, "NASA OPeNDAP did not respond before the request timed out.");
        }
        throw new ApiError(502, `${prefix}_UNAVAILABLE`, "NASA OPeNDAP could not be reached.");
    }
    if (response.status === 401 || response.status === 403) {
        throw new ApiError(502, `${prefix}_UNAUTHORIZED`,
            "NASA Earthdata refused the token. Check EARTHDATA_TOKEN and that the data archive is approved in your Earthdata profile.");
    }
    if (!response.ok) {
        throw new ApiError(502, `${prefix}_ERROR`, `NASA OPeNDAP returned HTTP ${response.status}.`);
    }

    // Lines look like "/group/variable[0], 0.1016, 0.0943".
    const firstValueByPath = new Map();
    for (const line of (await response.text()).split("\n")) {
        const match = /^(\/[^[,\s]+)(?:\[[^\]]*\])*,\s*([^,]*)/.exec(line.trim());
        if (match) {
            firstValueByPath.set(match[1], match[2].trim());
        }
    }

    return Object.fromEntries(Object.entries(variables).map(([name, expression]) => {
        const path = expression.slice(0, expression.indexOf("["));
        const raw = firstValueByPath.get(path);
        if (raw === undefined) {
            throw new ApiError(502, `${prefix}_INVALID_RESPONSE`, "NASA OPeNDAP returned an unexpected response.");
        }
        const value = Number(raw);
        return [name, raw === "" || !Number.isFinite(value) ? null : value];
    }));
}

/** Runs async tasks with at most `limit` in flight, preserving order. */
async function mapWithConcurrency(items, limit, task) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
        while (next < items.length) {
            const index = next;
            next += 1;
            results[index] = await task(items[index], index);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

// SMAP L3 uses the global EASE-Grid 2.0 (EPSG:6933) at 9 km.
const EASE2 = {
    a: 6378137.0,
    e: 0.0818191908426215,
    cellMetres: 9008.055210146,
    columns: 3856,
    rows: 1624
};

/** Row and column of the EASE-Grid 2.0 9 km cell containing a point. */
function ease2GridCell(latitude, longitude) {
    const { a, e, cellMetres, columns, rows } = EASE2;
    const k0 = Math.cos(Math.PI / 6) / Math.sqrt(1 - e * e * Math.sin(Math.PI / 6) ** 2);
    const sinLat = Math.sin(latitude * Math.PI / 180);
    const q = (1 - e * e) * (
        sinLat / (1 - e * e * sinLat * sinLat) -
        (1 / (2 * e)) * Math.log((1 - e * sinLat) / (1 + e * sinLat))
    );
    const x = a * k0 * longitude * Math.PI / 180;
    const y = a * q / (2 * k0);
    return {
        row: Math.floor(rows / 2 - y / cellMetres),
        column: Math.floor(x / cellMetres + columns / 2)
    };
}

module.exports = { ease2GridCell, mapWithConcurrency, readOpendapCells };
