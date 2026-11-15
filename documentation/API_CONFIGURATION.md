# API configuration

## Base URL and endpoints

The Express API is mounted at `/api`. The frontend uses the public
`VITE_API_BASE_URL` setting (normally `http://localhost:5000/api`) and appends
endpoint paths through its shared Axios client.

| Method and path | Purpose | Authentication |
| --- | --- | --- |
| `GET /api` | Lists the API's available endpoints. | None |
| `GET /api/health` | Confirms that the API process is reachable. | None |
| `GET /api/health/database` | Backward-compatible database connectivity check. | None |
| `GET /api/health/supabase` | Performs a Supabase Data API query against `profiles`. | None |
| `GET /api/nasa/power` | Returns normalized NASA POWER daily observations and source metadata. | None |
| `GET /api/nasa/power/summary` | Returns derived period summaries and the underlying daily observations. | None |
| `GET /api/nasa/power/daily` | Backward-compatible raw NASA POWER response. | None |
| `POST /api/farms` | Creates a farm owned by the authenticated user. | Supabase access token |
| `GET /api/farms` | Lists only farms visible to the authenticated user. | Supabase access token |
| `PATCH /api/farms/:farmId` | Updates an owned farm. | Supabase access token |
| `POST /api/farms/:farmId/climate-observations/nasa` | Fetches NASA POWER data for the farm coordinates and saves observations. | Supabase access token |
| `GET /api/farms/:farmId/climate-observations` | Retrieves climate history; accepts optional `start`, `end` (`YYYY-MM-DD`), and `limit` query parameters. | Supabase access token |
| `GET /api/gambia` | Lists The Gambia's bounds and reference locations. | None |
| `GET /api/gambia/sources` | Lists every connected data source. | None |
| `GET /api/gambia/data/:sourceId` | Fetches one source for a location in The Gambia. | None |
| `GET /api/gambia/summary` | Fetches every fast source for one location. | None |
| `GET /api/gambia/recommendations` | Ranks crops for a location from suitability and current conditions. | None |
| `GET /api/gambia/rotation` | Plans a multi-year crop rotation for an upland field. | None |
| `GET /api/gambia/engine/districts` | Lists the farmer app's eight districts. | None |
| `POST /api/gambia/engine/plan` | The farmer app's rotation engine: best plan, alternatives, reasons and numbers. | None |
| `POST /api/gambia/engine/slot-options` | The farmer app's swap options for one season. | None |

Protected routes require `Authorization: Bearer <Supabase access token>`.
Requests use the project publishable key plus that access token; the backend
secret key is never used for ordinary farm or climate operations.

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

Request daily data for specific farm coordinates. Latitude and longitude are
required decimal degrees; `start` and `end` are explicit, valid calendar dates
in `YYYYMMDD` format. The service defaults to the supported Agroclimatology
(`AG`) parameters, or accepts an explicit comma-separated subset:

```text
GET /api/nasa/power?latitude=13.45&longitude=-16.58&start=20240101&end=20240103
```

To select parameters or a community explicitly:

```text
GET /api/nasa/power?latitude=13.45&longitude=-16.58&start=20240101&end=20240103&parameters=PRECTOTCORR,T2M,RH2M&community=AG
GET /api/nasa/power/summary?latitude=13.45&longitude=-16.58&start=20240101&end=20240103
```

Only these parameters are accepted:

| NASA POWER parameter | Meaning | Typical NASA unit |
| --- | --- | --- |
| `PRECTOTCORR` | Corrected precipitation | `mm/day` |
| `T2M` | Temperature at 2 meters | `C` |
| `T2M_MAX` | Maximum temperature at 2 meters | `C` |
| `T2M_MIN` | Minimum temperature at 2 meters | `C` |
| `RH2M` | Relative humidity at 2 meters | `%` |
| `ALLSKY_SFC_SW_DWN` | All-sky surface shortwave downward irradiance | `MJ/m^2/day` |

Units are taken from the NASA response metadata, not hardcoded into
observations. The service sends `format=JSON` and `community=AG` by default.
`community` accepts `AG` or `RE`; use `AG` for these Agroclimatology
parameters. The raw-response compatibility endpoint retains the native
NASA response shape.

The normalized `/power` response contains:

```json
{
  "source": "NASA POWER Daily API",
  "attribution": "NASA Langley Research Center POWER Project",
  "request": {
    "latitude": 13.45,
    "longitude": -16.58,
    "start": "20240101",
    "end": "20240103",
    "community": "AG",
    "parameters": ["PRECTOTCORR", "T2M", "T2M_MAX", "T2M_MIN", "RH2M", "ALLSKY_SFC_SW_DWN"]
  },
  "metadata": {
    "header": {},
    "messages": [],
    "parameters": {},
    "returnedDateCount": 3
  },
  "observations": [
    {
      "date": "2024-01-01",
      "parameter": "ALLSKY_SFC_SW_DWN",
      "value": 18.19,
      "unit": "MJ/m^2/day",
      "missing": false
    }
  ]
}
```

The `metadata.header`, `metadata.messages`, and each requested parameter's
metadata preserve fields returned by NASA. NASA's `-999` fill values and other
non-numeric/missing values are represented as `value: null`, `missing: true`;
no measurements are invented or interpolated.

`/power/summary` returns `summaries` for average `T2M`, maximum `T2M_MAX`,
minimum `T2M_MIN`, total `PRECTOTCORR`, average `RH2M`, and average
`ALLSKY_SFC_SW_DWN`. Each summary includes its NASA unit, source parameter,
and aggregation description; the response also includes the underlying
normalized observations. These are derived statistics, not individual NASA
observations. Missing values are excluded from calculations; if a parameter
has no valid values its summary value is `null`.

The exact coordinate supplied is sent to NASA POWER. It should be taken from
the farm record when available; the service does not substitute a city
centroid. NASA POWER is a gridded Earth-observation/reanalysis product, not an
on-farm sensor, so an API point response should not be interpreted as a
measurement at a particular field or plot. Availability, spatial resolution,
and accuracy vary by parameter and date. The NASA request/response metadata
and data limitations should accompany downstream use.

For authenticated farm records, `POST
/api/farms/:farmId/climate-observations/nasa` uses the stored farm coordinates,
fetches NASA data, and upserts non-missing values into `climate_observations`.
The unique key `(farm_id, source, parameter, observation_date)` prevents
duplicate rows when the same farm/date is fetched again. `GET
/api/farms/:farmId/climate-observations` retrieves the saved history subject
to RLS.

Successful requests are cached in memory for five minutes and concurrent
identical requests share an upstream request. The cache is process-local, not
a durable data store. NASA request timeouts return `504`; upstream/network or
invalid-response failures return `502`.

#### Live NASA verification

The following actual upstream request was tested using a point in The Gambia
for API verification only; it is not asserted to represent an individual farm:

```text
https://power.larc.nasa.gov/api/temporal/daily/point?latitude=13.45&longitude=-16.58&start=20240101&end=20240103&community=AG&parameters=PRECTOTCORR%2CT2M%2CT2M_MAX%2CT2M_MIN%2CRH2M%2CALLSKY_SFC_SW_DWN&format=JSON
```

NASA returned HTTP `200`, header API version `v2.10.3`, source metadata
`MERRA2`, `SYN1DEG`, and `POWER`, 3 dates, and 18 parameter/date observations.
Returned units were `mm/day`, `C`, `C`, `C`, `%`, and `MJ/m^2/day` for the
parameters listed above. The first normalized observation was
`ALLSKY_SFC_SW_DWN = 18.19 MJ/m^2/day` on `2024-01-01`. The summary route
returned average `T2M` `24.05 C`, maximum `T2M_MAX` `28.5 C`, minimum
`T2M_MIN` `20.34 C`, total `PRECTOTCORR` `1.59 mm/day`, average `RH2M`
`60.52%`, and average solar radiation `17.6 MJ/m^2/day`. Invalid latitude
and invalid calendar-date requests returned HTTP `400`; unit tests verified
that NASA `-999` missing values become `null` and are excluded from summaries.

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

Authenticated farm and climate endpoints verify Supabase access tokens and
preserve the user's RLS role when querying the database.
`GET /api/health/supabase` performs a real select against the `profiles` table
using the backend-only secret key and reports unavailable if the project or
schema cannot be reached. See [Supabase setup](SUPABASE_SETUP.md) for migration
and RLS details. The Supabase secret key must never be copied into a `VITE_`
variable.

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

**Farmer app engine.** The farmer app (`frontend/src`) calls
`POST /api/gambia/engine/plan` with `{ profile, scenario, fixed }` and
`POST /api/gambia/engine/slot-options` with `{ profile, scenario, slot, fixed }`.
Requests and responses follow `frontend/src/engine/contract.js`. A profile
without a location, soil or water returns `{ status: "insufficient", missing }`.

- **Climate record.** NASA POWER daily rainfall (`PRECTOTCORR`) and maximum
  temperature (`T2M_MAX`) for the last ten complete rainy seasons (May to
  December; a season counts once October is over) at the district
  headquarters. It's fetched in one request and cached for a day per district.
- **Past outcomes.** Each crop is replayed in each season:
  - Sowing waits for the onset of the rains (Sivakumar rule, by 31 August).
  - Effective rainfall over the crop's days (FAO/AGLW formula, adjusted for
    soil) is compared with its FAO water need, scaled to the early-maturing
    variety's growing time.
  - Dry spells count days under 2.5 mm, because gridded rain rarely reaches
    zero. The longest one in the first 60 days is checked against the crop's
    tolerance.
  - The crop is checked for maturing after the rains end (about 20 days of
    stored water after the last 10 mm day).
  - Heat during flowering uses `T2M_MAX`.

  Irrigated farms skip the water checks; lowland rice skips them too.
- **What-if scenarios.** `scenario.dRainPct` scales every day's rain and
  `scenario.dTempC` shifts every day's maximum temperature in the historical
  record. Results are tagged `hypothetical`.
- **Ranking.** Every crop sequence (up to 3 seasons, honouring pinned
  `fixed` crops) is scored from its record (good and poor seasons), FAO GAEZ
  suitability, soil fit and the farmer's priorities. It's rewarded for a
  legume before a cereal, and penalised for repeating a crop or family.
  Reasons use only the codes the app translates.

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
