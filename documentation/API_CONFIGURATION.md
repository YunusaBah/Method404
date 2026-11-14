# API configuration

## Base URL and endpoints

The Express API is mounted at `/api`. The frontend uses the public
`VITE_API_BASE_URL` setting (normally `http://localhost:5000/api`) and appends
endpoint paths through its shared Axios client.

| Method and path | Purpose | Authentication |
| --- | --- | --- |
| `GET /api` | Lists the API's available endpoints. | None |
| `GET /api/health` | Confirms that the API process is reachable. | None |
| `GET /api/health/database` | Checks connectivity to the configured PostgreSQL database. | None |
| `GET /api/nasa/power/daily` | Proxies a validated daily point request to NASA POWER. | None |
| `GET /api/gambia` | Lists The Gambia's bounds and the reference locations. | None |
| `GET /api/gambia/sources` | Lists every connected data source. | None |
| `GET /api/gambia/data/:sourceId` | Fetches one source for a location in The Gambia. | None |
| `GET /api/gambia/summary` | Fetches every fast source for one location. | None |
| `GET /api/gambia/recommendations` | Ranks crops for a location from suitability and current conditions. | None |
| `GET /api/gambia/rotation` | Plans a multi-year crop rotation for an upland field. | None |

`GET /api/health` returns:

```json
{
  "success": true,
  "message": "METHOD404 FarmShift AI API is running!",
  "project": "FarmShift AI",
  "team": "METHOD404"
}
```

### NASA POWER daily point request

Supply all required query parameters. Coordinates are decimal degrees,
`start` and `end` are valid calendar dates in `YYYYMMDD` format, and parameter
names are comma-separated NASA POWER parameter identifiers:

```text
GET /api/nasa/power/daily?latitude=13.45&longitude=-16.58&start=20240101&end=20240103&parameters=T2M,PRECTOTCORR&community=AG
```

`community` is optional and accepts `AG` (the default) or `RE`. The API returns
the NASA POWER JSON response without fabricating or transforming observations.
Responses for identical successful requests are cached in memory for five
minutes; concurrent identical requests share one upstream request. This cache
is process-local and is not a durable data store.

### Errors

Errors use a consistent JSON envelope:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_LATITUDE",
    "message": "latitude must be a number between -90 and 90."
  },
  "message": "latitude must be a number between -90 and 90."
}
```

Invalid NASA request parameters return `400`; disallowed production CORS
origins return `403`; NASA failures return `502`; NASA timeouts return `504`.
Unexpected backend failures return a generic `500` message and are logged
server-side without returning stack traces or credentials.

The browser Axios client applies a ten-second timeout and normalizes HTTP,
timeout, and connection failures into reusable user-facing errors. NASA
requests use a separate 15-second server-side timeout.

## CORS and authentication

CORS allows the configured `CORS_ORIGINS` values. Development additionally
allows local HTTP origins so Vite can use another local port. Production
rejects an unlisted browser origin. Requests without an `Origin` header are
allowed; CORS is not authentication or access control for non-browser clients.

No endpoint currently requires authentication. Supabase is configuration-only:
the backend has a PostgreSQL connection pool for `DATABASE_URL` and a database
health check, but no application queries, user authentication, or persistence
are implemented. Run `npm run db:check --prefix backend` to test the connection.
The Supabase service-role key and database URL are read only by backend
configuration and must never be copied into a `VITE_` variable.

## The Gambia data endpoints

Every `/api/gambia` endpoint takes a location in one of two ways:

- `location`: one of `banjul`, `brikama`, `kerewan`, `mansa-konko`, `kuntaur`,
  `janjanbureh` (the default) or `basse`, one per administrative region.
- `latitude` and `longitude`: any point inside The Gambia. Points outside the
  country return `400 LOCATION_OUTSIDE_GAMBIA` before any upstream request.

Dates use `YYYY-MM-DD`. Every response includes `source`, `location`,
`request` (the dates and options actually used), `data` and `notes`. The notes
explain each source's resolution and limits.

| `sourceId` | Source | Returns | Options |
| --- | --- | --- | --- |
| `power` | NASA POWER | Daily temperature, rainfall, humidity, solar radiation, soil wetness | `start`, `end` (default: 30 days ending 7 days ago), `parameters` |
| `era5` | ERA5 reanalysis, via Open-Meteo | Daily temperature, rainfall, humidity, ET₀, soil moisture | `start`, `end` (same default) |
| `modis` | MODIS MOD13Q1, via NASA ORNL DAAC | 16-day NDVI at 250 m | `composites` (1–10, default 6), `start`, `end` |
| `viirs` | VIIRS VNP13A1, via NASA ORNL DAAC | 16-day NDVI at 500 m (ORNL record ends May 2024) | as `modis` |
| `srtm` | SRTM 30 m, via OpenTopoData | Elevation and slope | none |
| `gaez` | FAO GAEZ v4 | Rain-fed suitability index (0–100) and class for 12 Gambian crops | `input`: `low` (default) or `high` |
| `sentinel2` | Copernicus Sentinel-2 L2A STAC | Scenes covering the point, with previews | `start`, `end` (default: last 60 days), `maxCloud` (default 30), `limit` |
| `landsat` | USGS Landsat Collection 2 STAC | Scenes covering the point | as `sentinel2` |
| `smap` | NASA SMAP SPL3SMP_E | With a token: daily AM/PM soil moisture (m³/m³) for the 9 km cell. Without: latest files | `start`, `end` (default: 14 days ending yesterday; max 31) |
| `gpm-imerg` | NASA GPM IMERG Late Run | With a token: daily rainfall (mm) for the 0.1° cell. Without: latest files | `start`, `end` (default: 30 days ending yesterday; max 62) |
| `ecostress` | NASA ECOSTRESS ECO_L2T_LSTE (CMR) | Latest land-surface temperature files | `start`, `end`, `limit` |
| `gldas` | NASA GLDAS Noah 0.25° | With a token: 3-hourly topsoil and root-zone moisture, rainfall, evapotranspiration and air temperature. Without: latest files | `limit` (default 16, max 40), or `start`, `end` |
| `grace-fo` | NASA GRACE/GRACE-FO JPL mascons (CMR) | The water-storage file | `limit` |

```text
GET /api/gambia/data/power?location=basse&start=2026-08-01&end=2026-08-31
GET /api/gambia/data/gaez?latitude=13.27&longitude=-16.65&input=high
GET /api/gambia/summary?location=kerewan
```

**Values and catalogue sources.** `power`, `era5`, `modis`, `viirs`, `srtm` and
`gaez` return numbers for the point, and so do `smap`, `gpm-imerg` and `gldas`
when `EARTHDATA_TOKEN` is set. The others are catalogue sources: they
return the scenes or NASA files that cover the point, with download links.
Downloading NASA Earthdata files requires a free Earthdata Login. Put a token
from https://urs.earthdata.nasa.gov/ in `backend/.env` as `EARTHDATA_TOKEN`
(never in a `VITE_` variable). With a token, `smap`, `gpm-imerg` and `gldas`
become values sources: the backend reads only the grid cell containing the
location from each file through NASA's cloud OPeNDAP service
(`opendap.earthdata.nasa.gov`), so a request transfers a few bytes per day
instead of whole files. It sends at most six such reads at a time, and caches
each one for seven days. GES DISC data (GPM, GLDAS) also requires approving
the "NASA GESDISC DATA ARCHIVE" application in the Earthdata Login profile;
otherwise these sources return `502 <SOURCE>_UNAUTHORIZED`. `ecostress` and
`grace-fo` remain catalogue sources.

**Crop recommendations.** `GET /api/gambia/recommendations?location=basse&input=low`
(`input`: `low` or `high`) combines FAO GAEZ suitability (required) with GPM
or NASA POWER rainfall, SMAP or NASA POWER soil moisture, and an ERA5 water
balance. Each crop is placed in one group: `plant-now` (in its sowing window
and the rains have started, using the Sivakumar 1988 onset rule),
`plant-now-irrigated` (dry-season vegetables), `wait-for-rains`,
`next-season` or `not-suitable` (rain-fed GAEZ index below 10). Every crop
includes plain-language `reasons`, its sowing months, and FAO water-need and
growing-period ranges. The response also returns `season`, `conditions` and
the status of each input source. Sowing months and water needs are general
regional guidance in `services/gambia/cropCalendar.js`.

**Crop rotation.** `GET /api/gambia/rotation?location=basse&years=3&irrigation=true&previous=Groundnut&input=low`
plans `years` (2–5, default 3) of rainy and dry seasons for an upland field.
`irrigation` (`true`/`false`, default `false`) decides whether dry seasons
grow vegetables or stay fallow. `previous` is last rainy season's crop (or
`none`), so the plan can follow it correctly.

- The growing period comes from NASA POWER climatology (long-term monthly
  means). It counts the days when rainfall is at least half of potential
  evapotranspiration (FAO method), plus about 100 mm of stored soil water.
  Potential evapotranspiration is estimated with the Hargreaves equation
  (`T2M`, `T2M_RANGE`, `TOA_SW_DWN`).
- Rain-fed upland crops enter the rotation if their FAO GAEZ index is at
  least 10 and they mature within the growing period. Cassava is exempt from
  the season-length check because it grows through the dry season.
- Each rainy season picks the best-scoring crop. The score is GAEZ
  suitability, adjusted to favour a legume after a cereal, avoid the previous
  season's plant family, and avoid repeating a crop within two seasons.
- With irrigation, dry seasons rotate onion, tomato and cabbage so no family
  repeats within two dry seasons. After cassava, the dry season is marked
  `occupied`.

The response includes `growingSeason` (monthly normals and the derived
period), `plan` (each year's `rainy` and `dry` slot with `reasons`),
`candidates` (each crop with why it was included or excluded) and `summary`.

**Summary.** `/api/gambia/summary` fetches all sources in parallel and reports
each one's `status` separately, so one failing provider does not fail the
response. MODIS and VIIRS are skipped unless `include=all` is passed.

**Slow sources.** The ORNL MODIS/VIIRS service often takes about a minute per
request and returns HTTP 503 when busy. The backend sends it one request at a
time, retries transient errors twice, and caches results for 12 hours, so a
first load can take a few minutes.

**Caching and timeouts.** Every source has a process-local in-memory cache,
lasting 30 minutes for catalogues and up to 7 days for static data such as
GAEZ and SRTM. Concurrent identical requests share one upstream call, and
failures are not cached. Upstream failures return `502 <SOURCE>_ERROR` or
`<SOURCE>_UNAVAILABLE`; timeouts return `504 <SOURCE>_TIMEOUT`. No API keys are
required.
