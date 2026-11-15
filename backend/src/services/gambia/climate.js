const { ApiError } = require("../../middleware/apiError");
const { createCache, fetchJson } = require("../external/http");
const { createNasaPowerService } = require("../nasaPowerService");
const { resolveDateRange } = require("./dates");

const POWER_DEFAULT_PARAMETERS = [
    "T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "RH2M", "ALLSKY_SFC_SW_DWN", "GWETTOP", "GWETROOT"
];
const POWER_FILL_VALUE = -999;

const ERA5_URL = "https://archive-api.open-meteo.com/v1/archive";
const ERA5_DAILY_VARIABLES = [
    "temperature_2m_max",
    "temperature_2m_min",
    "temperature_2m_mean",
    "precipitation_sum",
    "relative_humidity_2m_mean",
    "et0_fao_evapotranspiration",
    "shortwave_radiation_sum",
    "soil_moisture_0_to_7cm_mean",
    "soil_moisture_7_to_28cm_mean"
];

function createPowerSource({ fetchImpl, now, powerService } = {}) {
    const service = powerService || createNasaPowerService({ fetchImpl, now });

    return {
        id: "power",
        name: "NASA POWER",
        provider: "NASA Langley Research Center",
        category: "climate",
        access: "values",
        measures: "Daily temperature, rainfall, humidity, solar radiation and soil wetness",
        link: "https://power.larc.nasa.gov/",
        async fetch({ location, query }) {
            const range = resolveDateRange(query, { now, defaultDays: 30, lagDays: 7, maxDays: 366 });
            const parameters = query.parameters || POWER_DEFAULT_PARAMETERS.join(",");
            const payload = await service.getDailyPointData({
                latitude: String(location.latitude),
                longitude: String(location.longitude),
                start: range.start.replaceAll("-", ""),
                end: range.end.replaceAll("-", ""),
                parameters,
                community: "AG"
            });

            const values = payload.properties.parameter;
            const names = Object.keys(values);
            const dates = Object.keys(values[names[0]] || {}).sort();
            const daily = dates.map((compactDate) => {
                const row = {
                    date: `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`
                };
                for (const name of names) {
                    const value = values[name][compactDate];
                    row[name] = value === POWER_FILL_VALUE || value === undefined ? null : value;
                }
                return row;
            });
            const units = Object.fromEntries(names.map((name) => [name, payload.parameters?.[name]?.units ?? null]));
            const descriptions = Object.fromEntries(
                names.map((name) => [name, payload.parameters?.[name]?.longname ?? null])
            );

            return {
                request: { ...range, parameters: names },
                data: { units, descriptions, daily },
                notes: [
                    "Values are NASA POWER modelled and satellite-derived estimates at about 0.5 degree resolution, not field measurements.",
                    "Days NASA POWER has not yet published are returned as null."
                ]
            };
        }
    };
}

function createEra5Source({ fetchImpl, now } = {}) {
    const cached = createCache({ ttlMs: 60 * 60 * 1000, now });

    return {
        id: "era5",
        name: "ERA5 reanalysis",
        provider: "ECMWF Copernicus, served by Open-Meteo",
        category: "climate",
        access: "values",
        measures: "Daily temperature, rainfall, humidity, evapotranspiration and soil moisture",
        link: "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview",
        async fetch({ location, query }) {
            const range = resolveDateRange(query, {
                now, defaultDays: 30, lagDays: 7, maxDays: 366, earliest: "1940-01-01"
            });
            const url = new URL(ERA5_URL);
            url.searchParams.set("latitude", String(location.latitude));
            url.searchParams.set("longitude", String(location.longitude));
            url.searchParams.set("start_date", range.start);
            url.searchParams.set("end_date", range.end);
            url.searchParams.set("daily", ERA5_DAILY_VARIABLES.join(","));
            url.searchParams.set("models", "era5");
            url.searchParams.set("timezone", "GMT");

            const payload = await cached(url.toString(), () => fetchJson(url, {
                source: "era5", label: "The ERA5 archive", fetchImpl, timeoutMs: 20_000
            }));
            if (!payload?.daily?.time || !Array.isArray(payload.daily.time)) {
                throw new ApiError(502, "ERA5_INVALID_RESPONSE", "The ERA5 archive returned an unexpected response.");
            }

            const daily = payload.daily.time.map((date, index) => {
                const row = { date };
                for (const variable of ERA5_DAILY_VARIABLES) {
                    row[variable] = payload.daily[variable]?.[index] ?? null;
                }
                return row;
            });

            return {
                request: { ...range },
                data: {
                    gridPoint: { latitude: payload.latitude, longitude: payload.longitude },
                    units: Object.fromEntries(ERA5_DAILY_VARIABLES.map((v) => [v, payload.daily_units?.[v] ?? null])),
                    daily
                },
                notes: [
                    "ERA5 is a global reanalysis on a 0.25 degree grid (about 28 km), so values describe the surrounding grid cell.",
                    "Accessed through the Open-Meteo archive API, which serves ERA5 without a Copernicus account."
                ]
            };
        }
    };
}

module.exports = { POWER_DEFAULT_PARAMETERS, createEra5Source, createPowerSource };

const POWER_CLIMATOLOGY_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point";
const MONTH_KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
// FAO length of growing period: days when rainfall is at least half of
// potential evapotranspiration, plus the days needed to use up about 100 mm
// of water stored in the soil after the rains end.
const LGP_RAIN_RATIO = 0.5;
const STORED_SOIL_WATER_MM = 100;

function dayOfYearToMonthDay(dayOfYear) {
    const date = new Date(Date.UTC(2023, 0, 1) + (dayOfYear - 1) * 86400000);
    return date.toISOString().slice(5, 10);
}

/**
 * Estimates the growing period from monthly normals. Monthly values are
 * placed at mid-month and interpolated to daily values.
 */
function estimateGrowingPeriod(months) {
    const midpoints = [];
    let start = 0;
    for (const days of DAYS_IN_MONTH) {
        midpoints.push(start + days / 2);
        start += days;
    }
    const daily = [];
    for (let day = 0; day < 365; day += 1) {
        let next = midpoints.findIndex((mid) => mid > day + 0.5);
        if (next === -1) next = 12;
        const previous = (next + 11) % 12;
        const previousMid = next === 0 ? midpoints[11] - 365 : midpoints[previous];
        const nextMid = next === 12 ? midpoints[0] + 365 : midpoints[next];
        const weight = (day + 0.5 - previousMid) / (nextMid - previousMid);
        const pick = (key) => months[previous][key] * (1 - weight) + months[next % 12][key] * weight;
        daily.push({ rain: pick("rainMmPerDay"), et0: pick("et0MmPerDay") });
    }

    const humid = daily.map((day) => day.rain >= LGP_RAIN_RATIO * day.et0);
    // Find the longest run of humid days, allowing it to wrap over New Year.
    let best = { start: -1, length: 0 };
    for (let first = 0; first < 365; first += 1) {
        if (!humid[first] || humid[(first + 364) % 365]) continue;
        let length = 0;
        while (length < 365 && humid[(first + length) % 365]) length += 1;
        if (length > best.length) best = { start: first, length };
    }
    if (best.length === 0) {
        return null;
    }

    const endIndex = (best.start + best.length - 1) % 365;
    // After the rains, stored soil water lasts until it is used up at the
    // post-season evapotranspiration rate.
    let stored = STORED_SOIL_WATER_MM;
    let carryDays = 0;
    while (stored > 0 && carryDays < 60) {
        const day = daily[(endIndex + 1 + carryDays) % 365];
        stored -= Math.max(day.et0 - day.rain, 0);
        if (stored > 0) carryDays += 1;
    }
    const seasonRainMm = Array.from({ length: best.length }, (_, offset) => daily[(best.start + offset) % 365].rain)
        .reduce((sum, value) => sum + value, 0);

    return {
        rainySeasonStart: dayOfYearToMonthDay(best.start + 1),
        rainySeasonEnd: dayOfYearToMonthDay(endIndex + 1),
        rainySeasonDays: best.length,
        storedMoistureDays: carryDays,
        totalDays: best.length + carryDays,
        seasonRainfallMm: Math.round(seasonRainMm)
    };
}

/**
 * Long-term monthly climate normals from NASA POWER, and the growing period
 * derived from them. Potential evapotranspiration uses the Hargreaves
 * equation from mean temperature, daily temperature range and top-of-
 * atmosphere radiation, because POWER climatology has no ET0 parameter.
 */
function createPowerClimatology({ fetchImpl, now } = {}) {
    const cached = createCache({ ttlMs: 30 * 24 * 60 * 60 * 1000, now });

    return async function getClimateNormals(location) {
        const url = new URL(POWER_CLIMATOLOGY_URL);
        url.searchParams.set("latitude", String(location.latitude));
        url.searchParams.set("longitude", String(location.longitude));
        url.searchParams.set("community", "AG");
        url.searchParams.set("parameters", "PRECTOTCORR,T2M,T2M_RANGE,TOA_SW_DWN");
        url.searchParams.set("format", "JSON");

        const payload = await cached(url.toString(), () => fetchJson(url, {
            source: "power", label: "NASA POWER climatology", fetchImpl, timeoutMs: 30_000
        }));
        const parameter = payload?.properties?.parameter;
        if (!parameter?.PRECTOTCORR || !parameter.T2M || !parameter.T2M_RANGE || !parameter.TOA_SW_DWN) {
            throw new ApiError(502, "POWER_INVALID_RESPONSE", "NASA POWER climatology returned an unexpected response.");
        }

        const months = MONTH_KEYS.map((key, index) => {
            const rain = parameter.PRECTOTCORR[key];
            const tMean = parameter.T2M[key];
            const tRange = parameter.T2M_RANGE[key];
            // Hargreaves: 0.0023 (Tmean + 17.8) sqrt(Trange) Ra, Ra in mm/day.
            const et0 = 0.0023 * (tMean + 17.8) * Math.sqrt(Math.max(tRange, 0)) * parameter.TOA_SW_DWN[key] * 0.408;
            return {
                month: index + 1,
                rainMmPerDay: rain,
                et0MmPerDay: Number(et0.toFixed(2)),
                rainMm: Math.round(rain * DAYS_IN_MONTH[index]),
                et0Mm: Math.round(et0 * DAYS_IN_MONTH[index]),
                meanTemperatureC: tMean
            };
        });

        return {
            source: "NASA POWER climatology (long-term monthly means)",
            months,
            annualRainfallMm: months.reduce((sum, month) => sum + month.rainMm, 0),
            growingPeriod: estimateGrowingPeriod(months)
        };
    };
}

module.exports.createPowerClimatology = createPowerClimatology;
module.exports.estimateGrowingPeriod = estimateGrowingPeriod;
