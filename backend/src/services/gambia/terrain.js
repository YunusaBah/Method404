const { ApiError } = require("../../middleware/apiError");
const { createCache, fetchJson } = require("../external/http");

const OPENTOPODATA_URL = "https://api.opentopodata.org/v1/srtm30m";
// One SRTM 1 arc-second cell is about 30 m.
const CELL_DEGREES = 1 / 3600;
const METRES_PER_DEGREE_LATITUDE = 111_320;

/**
 * Slope and aspect from a 3x3 elevation window (Horn's method). `grid` is in
 * row-major order from north-west to south-east.
 */
function slopeFromGrid(grid, cellWidthMetres, cellHeightMetres) {
    const [a, b, c, d, , f, g, h, i] = grid;
    const dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * cellWidthMetres);
    const dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * cellHeightMetres);
    const slopeDegrees = Math.atan(Math.hypot(dzdx, dzdy)) * 180 / Math.PI;
    return Number(slopeDegrees.toFixed(2));
}

function createSrtmSource({ fetchImpl, now } = {}) {
    // Terrain does not change, so results are kept for a day.
    const cached = createCache({ ttlMs: 24 * 60 * 60 * 1000, now });

    return {
        id: "srtm",
        name: "SRTM elevation",
        provider: "NASA/USGS SRTM 30 m, served by OpenTopoData",
        category: "terrain",
        access: "values",
        measures: "Elevation and slope, used to judge drainage and erosion risk",
        link: "https://www.earthdata.nasa.gov/data/instruments/srtm",
        async fetch({ location }) {
            const points = [];
            for (const row of [1, 0, -1]) {
                for (const column of [-1, 0, 1]) {
                    points.push([
                        (location.latitude + row * CELL_DEGREES).toFixed(6),
                        (location.longitude + column * CELL_DEGREES).toFixed(6)
                    ].join(","));
                }
            }
            const url = new URL(OPENTOPODATA_URL);
            url.searchParams.set("locations", points.join("|"));

            const payload = await cached(url.toString(), () => fetchJson(url, {
                source: "srtm", label: "The SRTM elevation service", fetchImpl, timeoutMs: 20_000
            }));
            const elevations = payload?.results?.map((result) => result.elevation);
            if (payload?.status !== "OK" || elevations?.length !== 9) {
                throw new ApiError(502, "SRTM_INVALID_RESPONSE", "The SRTM elevation service returned an unexpected response.");
            }

            const centre = elevations[4];
            const complete = elevations.every((value) => typeof value === "number");
            const cellHeight = CELL_DEGREES * METRES_PER_DEGREE_LATITUDE;
            const cellWidth = cellHeight * Math.cos(location.latitude * Math.PI / 180);

            return {
                request: { dataset: "srtm30m" },
                data: {
                    elevationMetres: typeof centre === "number" ? centre : null,
                    slopeDegrees: complete ? slopeFromGrid(elevations, cellWidth, cellHeight) : null,
                    windowMetres: Math.round(cellHeight * 3)
                },
                notes: [
                    "Slope is estimated from a 3 x 3 window of 30 m SRTM cells around the location.",
                    "SRTM was recorded in February 2000 and measures the top of vegetation and buildings, not always bare ground."
                ]
            };
        }
    };
}

module.exports = { createSrtmSource, slopeFromGrid };
