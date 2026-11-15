# FarmShift AI: working features

This document describes features implemented in the repository and the
conditions required to use them. A feature being implemented does not mean
every upstream data provider or the hosted Supabase project has been verified
in the current environment.

## Run the application

Requirements: Node.js 20.19+ or 22.12+, and npm.

Install backend and frontend dependencies, then run both from the repository
root:

```powershell
cd backend
npm install
cd ..\frontend
npm install
cd ..
npm run dev
```

By default, the backend is at `http://localhost:5000` and the Vite frontend is
at `http://localhost:5173`. Configure the frontend API base URL in
`frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Restart Vite after changing environment variables. The backend reads
`backend/.env`; use `backend/.env.example` as the template. Do not put backend
secrets in frontend variables.

## Working frontend features

- **Climate overview:** compares NASA POWER and ERA5 climate data, including
  daily rainfall and temperature summaries/charts. It also shows NASA POWER
  surface/root-zone wetness indices, NASA SMAP surface soil moisture when
  `EARTHDATA_TOKEN` is configured, and ERA5 estimates for topsoil and deeper
  soil. These are grid estimates, not readings from a sensor installed in the
  farm.
- **Searchable locations:** choose from 18 Gambian town-centre reference
  points. Satellite and gridded estimates are for the surrounding area, not
  exact field measurements.
- **Data sources:** browse available sources and request source data or
  satellite-scene/file catalogues for a selected location in The Gambia.
- **Crop advice:** prioritizes up to three crop options using FAO GAEZ
  suitability, current-season NASA/ERA5 context, and available rainfall or
  soil-moisture information. Crop cards include example photos with source,
  creator, and license details; photos are illustrative and are not necessarily
  from The Gambia. A searchable 48-crop FAO GAEZ catalogue provides long-term
  suitability lookups; crops without reviewed local planting guidance are
  not presented as recommendations.
- **Crop Rotation Planner:** creates a 2–5 year rainy/dry-season plan using
  crop suitability, climate normals, prior crop, and the irrigation choice.

The Gambia dashboard uses named reference locations or coordinates within
The Gambia. These locations are regional reference points, not registered
farm boundaries. Do not interpret point or grid estimates as field
measurements.

## Backend API

All paths below are relative to `http://localhost:5000/api` by default.

| Method and path | What it does | Authentication |
|---|---|---|
| `GET /health` | Confirms the API process is reachable. | None |
| `GET /health/supabase` | Checks the Supabase Data API and `profiles` table. | None |
| `GET /gambia` | Returns The Gambia bounds and reference locations. | None |
| `GET /gambia/crops` | Lists FAO GAEZ crops and flags reviewed recommendations. | None |
| `GET /gambia/crops/:crop/prediction` | Returns a NASA POWER climate score with reviewed or estimated profile confidence. | None |
| `GET /gambia/sources` | Lists connected sources and their access type. | None |
| `GET /gambia/data/:sourceId` | Fetches one source for a location. | None |
| `GET /gambia/summary` | Requests the fast sources for a location and reports each result separately. | None |
| `GET /gambia/recommendations` | Returns crop suitability/season recommendations. | None |
| `GET /gambia/rotation` | Returns a multi-year crop rotation plan. | None |
| `GET /nasa/power` | Returns normalized NASA POWER observations. | None |
| `GET /nasa/power/summary` | Returns derived NASA POWER summaries and observations. | None |
| `GET /nasa/power/daily` | Returns the raw NASA POWER response for compatibility. | None |
| `POST /farms`, `GET /farms` | Create or list the authenticated user's farms. | Supabase bearer token |
| `PATCH /farms/:farmId` | Update an owned farm. | Supabase bearer token |
| `POST /farms/:farmId/climate-observations/nasa` | Fetch and save NASA POWER observations using the saved farm coordinates. | Supabase bearer token |
| `GET /farms/:farmId/climate-observations` | Retrieve saved climate history for an owned farm. | Supabase bearer token |

### Example requests

```text
GET http://localhost:5000/api/health
GET http://localhost:5000/api/gambia/data/power?location=basse&start=2026-08-01&end=2026-08-31
GET http://localhost:5000/api/gambia/crops/papaya/prediction?location=basse
GET http://localhost:5000/api/gambia/recommendations?location=basse&input=low
GET http://localhost:5000/api/gambia/data/gaez?location=basse&input=low&crop=Banana
GET http://localhost:5000/api/gambia/rotation?location=basse&years=3&irrigation=true&previous=Groundnut
GET http://localhost:5000/api/nasa/power?latitude=13.45&longitude=-16.58&start=20240101&end=20240103&parameters=PRECTOTCORR%2CT2M
```

Predictions using `estimated` profiles are preliminary climate screens, not
yield forecasts or validated planting recommendations. Only reviewed crops
enter the core ranking and rotation model.

For NASA POWER direct requests, supported `parameters` are
`PRECTOTCORR`, `T2M`, `T2M_MAX`, `T2M_MIN`, `RH2M`, and
`ALLSKY_SFC_SW_DWN`. Use a comma-separated subset; if omitted, the endpoint
uses its defaults. The direct POWER endpoint accepts `YYYYMMDD` dates. The
Gambia source endpoints use `YYYY-MM-DD` dates.

## Data-source status

The backend has source adapters for the following data:

| Source ID | Data | Status / requirement |
|---|---|---|
| `power` | NASA POWER daily climate and climate normals | Values returned by the API. |
| `era5` | ERA5 daily climate via Open-Meteo | Values returned by the API. |
| `modis`, `viirs` | Vegetation-index point values | MODIS/VIIRS values are available through the configured source adapter; requests can be slow. |
| `srtm` | Elevation and slope | Values returned by the API. |
| `gaez` | FAO GAEZ crop suitability | Values returned by the API. |
| `smap` | SMAP soil moisture | Values require `EARTHDATA_TOKEN`; otherwise the API lists covering files. |
| `gpm-imerg` | GPM IMERG rainfall | Values require `EARTHDATA_TOKEN` and NASA GESDISC archive access; otherwise the API lists files. |
| `gldas` | GLDAS land-surface variables | Values require `EARTHDATA_TOKEN` and NASA GESDISC archive access; otherwise the API lists files. |
| `sentinel2`, `landsat` | Satellite scenes | Catalogue results; the API does not provide complete field imagery analysis. |
| `ecostress`, `grace-fo` | Satellite/mission products | Catalogue results; values are not extracted by the current adapters. |

`EARTHDATA_TOKEN` belongs only in the backend environment. Some NASA GESDISC
collections also require accepting the relevant data-use application in the
Earthdata profile. Upstream availability, coverage, spatial resolution, and
quality vary by product and date.

## Supabase status and setup

The code includes Supabase client configuration, Auth-token validation,
authenticated farm CRUD, climate observation persistence, a health check, and
an additive SQL migration at
`supabase/migrations/20261114000000_farmshift_schema.sql`. The migration
creates the application tables and row-level security policies.

The hosted farm and climate operations require the migration to be applied to
the intended Supabase project and valid project environment variables to be
configured. The last recorded hosted check found `public.profiles` missing
from the Supabase API schema cache; hosted table operations have therefore
not been verified. See [Supabase setup](SUPABASE_SETUP.md) before relying on
hosted persistence.

Protected farm endpoints require:

```http
Authorization: Bearer <Supabase user access token>
```

The backend uses the publishable key together with the user's token for
ordinary database operations so row-level security applies. Never expose
`SUPABASE_SECRET_KEY` or `EARTHDATA_TOKEN` to the browser.

## Errors and data integrity

Known API errors use JSON with an error code and message. A `400` generally
indicates invalid request inputs; `401` indicates a missing/invalid Supabase
token; `404` may indicate an unknown source or a route missing from the
running backend; `502`/`504` indicates an upstream provider failure or
timeout. When a route returns `404`, confirm that the backend was restarted
after updating the code and check `GET /api` for its available route list.

Missing NASA values remain missing rather than being fabricated. Summaries
are derived from available values, and source metadata and units are retained
where provided by the source.

## Validation

Run the repository checks:

```powershell
cd backend
npm test
cd ..\frontend
npm run lint
npm run build
```

These checks cover local code behavior; they do not prove that every external
provider is currently reachable or that the hosted Supabase migration has
been applied.

## More detail

- [API routes, request/response shapes, and source limitations](API_CONFIGURATION.md)
- [Data source references and gaps](DATA_SOURCES.md)
- [Supabase configuration, migration, and RLS](SUPABASE_SETUP.md)
- [Environment variables](ENVIRONMENT_SETUP.md)
