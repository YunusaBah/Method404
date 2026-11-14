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
