const { ApiError } = require("../middleware/apiError");

// Approximate land extent of The Gambia in decimal degrees (WGS 84).
const GAMBIA_BOUNDS = Object.freeze({
    west: -16.83,
    south: 13.06,
    east: -13.79,
    north: 13.83
});

// Coordinates within this margin of the bounds are accepted, so points on the
// river banks and border are not rejected by rounding.
const BOUNDS_MARGIN_DEGREES = 0.05;

// Reference town points for satellite and gridded datasets. These coordinates
// are town centres, not surveyed farm locations.
const GAMBIA_LOCATIONS = Object.freeze([
    { id: "banjul", name: "Banjul", region: "Banjul", latitude: 13.4549, longitude: -16.579 },
    { id: "brikama", name: "Brikama", region: "West Coast", latitude: 13.2714, longitude: -16.6494 },
    { id: "kerewan", name: "Kerewan", region: "North Bank", latitude: 13.4898, longitude: -16.0888 },
    { id: "mansa-konko", name: "Mansa Konko", region: "Lower River", latitude: 13.4433, longitude: -15.5386 },
    { id: "kuntaur", name: "Kuntaur", region: "Central River (north)", latitude: 13.6721, longitude: -14.8895 },
    { id: "janjanbureh", name: "Janjanbureh", region: "Central River", latitude: 13.5352, longitude: -14.7663 },
    { id: "basse", name: "Basse Santa Su", region: "Upper River", latitude: 13.3098, longitude: -14.2142 },
    { id: "serrekunda", name: "Serrekunda", region: "Kanifing", latitude: 13.4388, longitude: -16.6748 },
    { id: "bakau", name: "Bakau", region: "Kanifing", latitude: 13.4775, longitude: -16.6779 },
    { id: "sukuta", name: "Sukuta", region: "West Coast", latitude: 13.4148, longitude: -16.7076 },
    { id: "farafenni", name: "Farafenni", region: "North Bank", latitude: 13.5721, longitude: -15.5979 },
    { id: "barra", name: "Barra", region: "North Bank", latitude: 13.4856, longitude: -16.5435 },
    { id: "essau", name: "Essau", region: "North Bank", latitude: 13.4858, longitude: -16.5262 },
    { id: "soma", name: "Soma", region: "Lower River", latitude: 13.4446, longitude: -15.5355 },
    { id: "bansang", name: "Bansang", region: "Central River", latitude: 13.4358, longitude: -14.6588 },
    { id: "gunjur", name: "Gunjur", region: "West Coast", latitude: 13.1760, longitude: -16.7599 },
    { id: "sanyang", name: "Sanyang", region: "West Coast", latitude: 13.2676, longitude: -16.7584 },
    { id: "bintang-bolong", name: "Bintang Bolong", region: "West Coast", latitude: 13.2508, longitude: -16.2120 }
].map(Object.freeze));

const DEFAULT_LOCATION_ID = "janjanbureh";

function isInGambia(latitude, longitude) {
    return latitude >= GAMBIA_BOUNDS.south - BOUNDS_MARGIN_DEGREES &&
        latitude <= GAMBIA_BOUNDS.north + BOUNDS_MARGIN_DEGREES &&
        longitude >= GAMBIA_BOUNDS.west - BOUNDS_MARGIN_DEGREES &&
        longitude <= GAMBIA_BOUNDS.east + BOUNDS_MARGIN_DEGREES;
}

/**
 * Resolves a request to a point in The Gambia. Accepts either a `location`
 * id from GAMBIA_LOCATIONS or a `latitude`/`longitude` pair inside the
 * country's bounds. With neither, the default location is used.
 */
function resolveLocation({ location, latitude, longitude } = {}) {
    const hasCoordinates = latitude !== undefined || longitude !== undefined;

    if (location !== undefined && hasCoordinates) {
        throw new ApiError(400, "AMBIGUOUS_LOCATION", "Provide either location or latitude and longitude, not both.");
    }

    if (hasCoordinates) {
        const lat = Number(latitude);
        const lon = Number(longitude);
        if (latitude === "" || longitude === "" || !Number.isFinite(lat) || !Number.isFinite(lon)) {
            throw new ApiError(400, "INVALID_COORDINATES", "latitude and longitude must both be numbers.");
        }
        if (!isInGambia(lat, lon)) {
            throw new ApiError(
                400,
                "LOCATION_OUTSIDE_GAMBIA",
                "The coordinates are outside The Gambia. FarmShift AI currently covers The Gambia only."
            );
        }
        return {
            id: null,
            name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
            region: null,
            latitude: Number(lat.toFixed(4)),
            longitude: Number(lon.toFixed(4))
        };
    }

    const id = location === undefined ? DEFAULT_LOCATION_ID : String(location).toLowerCase();
    const match = GAMBIA_LOCATIONS.find((candidate) => candidate.id === id);
    if (!match) {
        throw new ApiError(
            400,
            "UNKNOWN_LOCATION",
            `location must be one of: ${GAMBIA_LOCATIONS.map((candidate) => candidate.id).join(", ")}.`
        );
    }
    return match;
}

/** A small bounding box around a point, in degrees, clipped to the country. */
function boxAround({ latitude, longitude }, halfSizeDegrees = 0.05) {
    return [
        Math.max(longitude - halfSizeDegrees, GAMBIA_BOUNDS.west - BOUNDS_MARGIN_DEGREES),
        Math.max(latitude - halfSizeDegrees, GAMBIA_BOUNDS.south - BOUNDS_MARGIN_DEGREES),
        Math.min(longitude + halfSizeDegrees, GAMBIA_BOUNDS.east + BOUNDS_MARGIN_DEGREES),
        Math.min(latitude + halfSizeDegrees, GAMBIA_BOUNDS.north + BOUNDS_MARGIN_DEGREES)
    ].map((value) => Number(value.toFixed(4)));
}

module.exports = {
    DEFAULT_LOCATION_ID,
    GAMBIA_BOUNDS,
    GAMBIA_LOCATIONS,
    boxAround,
    isInGambia,
    resolveLocation
};
