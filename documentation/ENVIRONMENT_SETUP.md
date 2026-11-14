# Environment setup

## Prerequisites

- Node.js 20.19+ (or 22.12+) and npm
- Python 3 for the data-processing environment

## Local development

Install Node dependencies in both projects:

```powershell
cd backend
npm install
cd ..\frontend
npm install
cd ..
```

Copy the example files when you want to customize local settings:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
Copy-Item data-processing\.env.example data-processing\.env
```

The repository includes a local `backend/.env` with development defaults and
empty optional Supabase values. It is ignored by Git. Never put real
credentials in an example file or frontend environment file.

Run the API and Vite together from the repository root with `npm run dev`, or
run either service using `npm run dev:backend` / `npm run dev:frontend`. The
backend defaults to port `5000`; the root launcher selects an available port
when necessary and sets Vite's API base URL to that backend's `/api` path.

### Backend variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `5000` | Express listening port, 1–65535. |
| `NODE_ENV` | `development` | `development`, `test`, or `production`. |
| `CLIENT_URL` | `http://localhost:5173` | Primary frontend origin; must be an origin, without a path. |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated exact browser origins allowed by CORS. |
| `NASA_POWER_BASE_URL` | NASA POWER daily point endpoint | Server-side NASA POWER endpoint. Production requires HTTPS. |
| `SUPABASE_URL` | Empty | Optional future Supabase project URL. |
| `SUPABASE_ANON_KEY` | Empty | Optional public Supabase key; backend-only configuration for now. |
| `SUPABASE_SERVICE_ROLE_KEY` | Empty | Optional privileged key; keep secret and backend-only. |
| `DATABASE_URL` | Empty | Optional PostgreSQL connection URL; backend-only. Required only when using database features. |

Backend configuration is loaded from `backend/.env`. Invalid values stop the
server with a descriptive configuration error. Supabase values are optional
until needed. The backend PostgreSQL pool uses TLS with certificate
verification. Check connectivity with `npm run db:check --prefix backend`;
`GET /api/health/database` reports connected/unavailable without exposing
connection details. For an IPv4-only network, choose **Session pooler** in the
Supabase Dashboard's **Connect** dialog and put its exact URI in `DATABASE_URL`.
Pooler hosts are project-specific; don't construct them from the region. Replace
the password placeholder locally, URL-encoding reserved characters. If
authentication is rejected, reset the database password in Supabase and update
the URI. Never disable TLS verification to work around certificate errors.

### Frontend variables

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:5000/api` | Public URL of the API prefix used by the shared Axios client. |

Vite embeds every `VITE_` variable into browser assets. This variable must
contain only the public API URL—never an API key, service-role key, database
URL, or other credential. Axios uses a ten-second request timeout.

### Python variables

`data-processing/config.py` loads `data-processing/.env` with
`python-dotenv` and also respects environment variables supplied by the
process:

| Variable | Default | Description |
| --- | --- | --- |
| `NASA_POWER_BASE_URL` | NASA POWER daily point endpoint | NASA POWER endpoint for future processing jobs. |
| `NASA_REQUEST_TIMEOUT_SECONDS` | `15` | Positive upstream request timeout in seconds. |

Install Python dependencies with `python -m pip install -r data-processing/requirements.txt`.
The Python configuration contains no duplicated credentials.

## Production

Set `NODE_ENV=production`, `CLIENT_URL` to the canonical frontend origin, and
`CORS_ORIGINS` to a comma-separated allowlist that includes that origin.
Production startup requires both origin settings, disallows localhost entries,
and requires HTTPS for `NASA_POWER_BASE_URL` and `SUPABASE_URL`. Supply secrets
through the deployment platform's secret manager, not source control. Keep
`SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` exclusively in the backend
runtime.

The application has a backend PostgreSQL connection pool and database
connectivity check, but no user authentication, database schema, application
queries, or persistence workflows yet. NASA SMAP/GPM/MODIS integrations also
require separate implementation and testing before being considered
operational.
