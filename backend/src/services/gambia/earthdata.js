const { ApiError } = require("../../middleware/apiError");
const { config } = require("../../config");
const { createCache, fetchJson } = require("../external/http");
const { resolveDateRange } = require("./dates");
const { ease2GridCell, mapWithConcurrency, readOpendapCells } = require("./opendap");

const CMR_GRANULES_URL = "https://cmr.earthdata.nasa.gov/search/granules.json";
const DATA_LINK_REL = "http://esipfed.org/ns/fedsearch/1.1/data#";
const MAX_GRANULES = 20;
const OPENDAP_PREFIX = "https://opendap.earthdata.nasa.gov/";
const OPENDAP_CONCURRENCY = 6;

function cleanValue(value, { scale = 1, offset = 0, digits = 3 } = {}) {
    // NASA files mark missing data with large negative or huge fill values.
    if (value === null || value <= -9999 || Math.abs(value) >= 1e10) return null;
    return Number((value * scale + offset).toFixed(digits));
}

// How to read point values from each dataset when an Earthdata token is set.
// Index ranges request two cells along the last dimension (see opendap.js).
const VALUE_READERS = {
    smap: {
        defaultDays: 14,
        maxItems: 31,
        resolution: "9 km EASE-Grid 2.0 cell",
        cell({ latitude, longitude }) {
            const { row, column } = ease2GridCell(latitude, longitude);
            return { row, column };
        },
        variables({ row, column }) {
            const at = `[${row}:${row}][${column}:${column + 1}]`;
            return {
                am: `/Soil_Moisture_Retrieval_Data_AM/soil_moisture${at}`,
                pm: `/Soil_Moisture_Retrieval_Data_PM/soil_moisture_pm${at}`
            };
        },
        fields: [
            { key: "soilMoistureAm", label: "Soil moisture, 6 am pass", unit: "m³/m³", digits: 3 },
            { key: "soilMoisturePm", label: "Soil moisture, 6 pm pass", unit: "m³/m³", digits: 3 }
        ],
        toRow: (values) => ({ soilMoistureAm: cleanValue(values.am), soilMoisturePm: cleanValue(values.pm) }),
        timeKey: "date",
        notes: [
            "SMAP measures moisture in the top 5 cm of soil. Dry sandy soil is often below 0.1 m³/m³; wet soil is above 0.3.",
            "SMAP passes over each location only every two to three days, so many days have no reading (null)."
        ]
    },
    "gpm-imerg": {
        defaultDays: 30,
        maxItems: 62,
        resolution: "0.1 degree cell (about 11 km)",
        cell: ({ latitude, longitude }) => ({
            lon: Math.floor((longitude + 180) / 0.1),
            lat: Math.floor((latitude + 90) / 0.1)
        }),
        variables: ({ lon, lat }) => ({ precipitation: `/precipitation[0:0][${lon}:${lon}][${lat}:${lat + 1}]` }),
        fields: [{ key: "precipitationMm", label: "Rainfall", unit: "mm/day", digits: 1 }],
        toRow: (values) => ({ precipitationMm: cleanValue(values.precipitation, { digits: 2 }) }),
        timeKey: "date",
        notes: [
            "IMERG Late Run is a near-real-time satellite rainfall estimate, published about two days after the day it covers.",
            "Values are daily totals for the 0.1 degree grid cell containing the location."
        ]
    },
    gldas: {
        defaultItems: 16,
        maxItems: 40,
        resolution: "0.25 degree cell (about 28 km)",
        cell: ({ latitude, longitude }) => ({
            lat: Math.floor((latitude + 60) / 0.25),
            lon: Math.floor((longitude + 180) / 0.25)
        }),
        variables({ lat, lon }) {
            const at = `[0:0][${lat}:${lat}][${lon}:${lon + 1}]`;
            return {
                soil: `/SoilMoi0_10cm_inst${at}`,
                root: `/RootMoist_inst${at}`,
                rain: `/Rainf_f_tavg${at}`,
                evap: `/Evap_tavg${at}`,
                air: `/Tair_f_inst${at}`
            };
        },
        fields: [
            { key: "soilMoisture0To10cm", label: "Topsoil moisture (0-10 cm)", unit: "m³/m³", digits: 3 },
            { key: "rootZoneMoisture", label: "Root-zone moisture", unit: "kg/m²", digits: 0 },
            { key: "rainfallRate", label: "Rainfall rate", unit: "mm/h", digits: 2 },
            { key: "evapotranspirationRate", label: "Evapotranspiration", unit: "mm/h", digits: 2 },
            { key: "airTemperature", label: "Air temperature", unit: "°C", digits: 1 }
        ],
        toRow: (values) => ({
            // 1 kg/m² of water in a 10 cm layer is 0.01 m³/m³.
            soilMoisture0To10cm: cleanValue(values.soil, { scale: 0.01 }),
            rootZoneMoisture: cleanValue(values.root, { digits: 1 }),
            // kg/m²/s of water is mm/s.
            rainfallRate: cleanValue(values.rain, { scale: 3600, digits: 3 }),
            evapotranspirationRate: cleanValue(values.evap, { scale: 3600, digits: 3 }),
            airTemperature: cleanValue(values.air, { offset: -273.15, digits: 1 })
        }),
        timeKey: "time",
        notes: [
            "GLDAS is a land-surface model driven by satellite and ground observations, published about two to three months late.",
            "Each value is a 3-hourly model state or average for the 0.25 degree grid cell containing the location."
        ]
    }
};

function opendapUrlOf(entry) {
    return entry.links?.find((link) => link.href?.startsWith(OPENDAP_PREFIX))?.href ?? null;
}

// Some dates have more than one file version (for example _001 and _002).
// Keep the newest version of each.
function latestVersionPerTime(entries, timeKey) {
    const byTime = new Map();
    for (const entry of entries) {
        const time = timeKey === "date" ? entry.time_start?.slice(0, 10) : entry.time_start;
        const current = byTime.get(time);
        const id = entry.producer_granule_id || entry.title || "";
        if (!current || id > (current.producer_granule_id || current.title || "")) {
            byTime.set(time, entry);
        }
    }
    return [...byTime.entries()].sort(([a], [b]) => a.localeCompare(b));
}

// NASA datasets whose files require a free Earthdata Login to download. The
// public CMR catalogue lists which files cover a location; the files
// themselves are not downloaded or decoded here.
const DATASETS = {
    smap: {
        shortName: "SPL3SMP_E",
        name: "NASA SMAP soil moisture",
        measures: "Daily surface soil moisture on a 9 km grid",
        link: "https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/smap"
    },
    "gpm-imerg": {
        // The Late Run is published about two days after observation; the
        // Final Run (GPM_3IMERGDF) lags by several months.
        shortName: "GPM_3IMERGDL",
        name: "NASA GPM IMERG rainfall (Late Run)",
        measures: "Daily satellite rainfall on a 0.1 degree grid",
        link: "https://gpm.nasa.gov/data"
    },
    ecostress: {
        shortName: "ECO_L2T_LSTE",
        name: "NASA ECOSTRESS land-surface temperature",
        measures: "70 m land-surface temperature, an input to crop water stress",
        link: "https://ecostress.jpl.nasa.gov/data",
        // Each granule has several files; link the temperature layer.
        preferredFile: /_LST\.tif$/
    },
    gldas: {
        shortName: "GLDAS_NOAH025_3H",
        name: "NASA GLDAS land-surface model",
        measures: "3-hourly soil moisture, evapotranspiration and runoff on a 0.25 degree grid",
        link: "https://ldas.gsfc.nasa.gov/gldas"
    },
    "grace-fo": {
        shortName: "TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4",
        name: "NASA GRACE and GRACE-FO water storage",
        measures: "Monthly change in total land water storage",
        link: "https://grace.jpl.nasa.gov/data/get-data/"
    }
};

function pickDownloadUrl(links, preferredFile) {
    const candidates = (links || [])
        .filter((link) => link.rel === DATA_LINK_REL && !link.inherited && link.href?.startsWith("https://"))
        .map((link) => link.href);
    return (preferredFile && candidates.find((href) => preferredFile.test(href))) || candidates[0] || null;
}

function createEarthdataSource(kind, deps = {}) {
    const { fetchImpl, now } = deps;
    const spec = DATASETS[kind];
    const cached = createCache({ ttlMs: 30 * 60 * 1000, now });
    // Granule values never change once published.
    const cellCache = createCache({ ttlMs: 7 * 24 * 60 * 60 * 1000, maxEntries: 5000, now });
    const token = "earthdataToken" in deps ? deps.earthdataToken : config.earthdata.token;
    const reader = token ? VALUE_READERS[kind] : undefined;

    async function searchGranules(location, { range, pageSize }) {
        const url = new URL(CMR_GRANULES_URL);
        url.searchParams.set("short_name", spec.shortName);
        url.searchParams.set("point", `${location.longitude},${location.latitude}`);
        url.searchParams.set("sort_key", "-start_date");
        url.searchParams.set("page_size", String(pageSize));
        if (range) {
            url.searchParams.set("temporal", `${range.start}T00:00:00Z,${range.end}T23:59:59Z`);
        }
        const payload = await cached(url.toString(), () => fetchJson(url, {
            source: kind, label: "The NASA Earthdata catalogue", fetchImpl, timeoutMs: 20_000
        }));
        const entries = payload?.feed?.entry;
        if (!Array.isArray(entries)) {
            throw new ApiError(502, `${kind.toUpperCase().replaceAll("-", "_")}_INVALID_RESPONSE`,
                "The NASA Earthdata catalogue returned an unexpected response.");
        }
        return entries;
    }

    async function fetchValues({ location, query }) {
        let range = null;
        let pageSize;
        if (reader.defaultDays) {
            range = resolveDateRange(query, {
                now, defaultDays: reader.defaultDays, lagDays: 1, maxDays: reader.maxItems, earliest: "2000-01-01"
            });
            // Allow for duplicate file versions within the range.
            pageSize = Math.min(range.days * 2, 2000);
        } else {
            const limit = query.limit === undefined ? reader.defaultItems : Number(query.limit);
            if (!Number.isInteger(limit) || limit < 1 || limit > reader.maxItems) {
                throw new ApiError(400, "INVALID_LIMIT", `limit must be an integer from 1 to ${reader.maxItems}.`);
            }
            if (query.start !== undefined || query.end !== undefined) {
                range = resolveDateRange(query, { now, maxDays: 31, earliest: "2000-01-01" });
            }
            pageSize = limit;
        }

        const entries = await searchGranules(location, { range, pageSize });
        const cell = reader.cell(location);
        const variables = reader.variables(cell);
        const granules = latestVersionPerTime(entries, reader.timeKey).slice(-(reader.maxItems));

        const series = await mapWithConcurrency(granules, OPENDAP_CONCURRENCY, async ([time, entry]) => {
            const opendapUrl = opendapUrlOf(entry);
            const row = { [reader.timeKey]: time };
            if (!opendapUrl) {
                return { ...row, ...reader.toRow({}) };
            }
            const values = await cellCache(`${opendapUrl}|${Object.values(variables).join(";")}`,
                () => readOpendapCells(opendapUrl, variables, { source: kind, token, fetchImpl }));
            return { ...row, ...reader.toRow(values) };
        });

        return {
            request: { shortName: spec.shortName, ...(range || {}), granules: granules.length },
            data: { gridCell: { ...cell, resolution: reader.resolution }, fields: reader.fields, series },
            notes: reader.notes
        };
    }

    return {
        id: kind,
        name: spec.name,
        provider: reader ? "NASA Earthdata (OPeNDAP point values)" : "NASA Earthdata CMR catalogue",
        category: "earthdata",
        access: reader ? "values" : "catalog",
        measures: spec.measures,
        link: spec.link,
        async fetch({ location, query }) {
            if (reader) {
                return fetchValues({ location, query });
            }
            // Without start or end, return the latest files, however recent.
            // Providers publish on different schedules, so a fixed default
            // window would often be empty.
            const range = query.start === undefined && query.end === undefined
                ? null
                : resolveDateRange(query, { now, defaultDays: 30, maxDays: 7305, earliest: "2000-01-01" });
            const limit = query.limit === undefined ? 10 : Number(query.limit);
            if (!Number.isInteger(limit) || limit < 1 || limit > MAX_GRANULES) {
                throw new ApiError(400, "INVALID_LIMIT", `limit must be an integer from 1 to ${MAX_GRANULES}.`);
            }

            const entries = await searchGranules(location, { range, pageSize: limit });

            const granules = entries.map((entry) => ({
                id: entry.producer_granule_id || entry.title,
                start: entry.time_start ?? null,
                end: entry.time_end ?? null,
                sizeMB: entry.granule_size ? Number(Number(entry.granule_size).toFixed(2)) : null,
                downloadUrl: pickDownloadUrl(entry.links, spec.preferredFile)
            }));

            return {
                request: { shortName: spec.shortName, ...(range || {}), limit },
                data: { granules },
                notes: [
                    "These are the data files that cover this location, newest first. Values are not extracted from them.",
                    "Downloading the files requires a free NASA Earthdata Login (https://urs.earthdata.nasa.gov/)."
                ]
            };
        }
    };
}

module.exports = { EARTHDATA_DATASETS: DATASETS, createEarthdataSource };
