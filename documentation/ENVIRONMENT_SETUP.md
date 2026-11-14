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

The repository may include a local `backend/.env` with development defaults.
It is ignored by Git. Never put secret credentials in an example file or
frontend environment file.

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
| `SUPABASE_URL` | Empty | Supabase project URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Empty | Public key used with a verified user's access token for RLS-scoped API operations. |
| `SUPABASE_SECRET_KEY` | Empty | Backend-only secret key, used only for the Supabase health check. |

Backend configuration is loaded from `backend/.env`. Invalid values stop the
server with a descriptive configuration error. Supabase settings may remain
empty for frontend/backend development, but Supabase endpoints report a clear
configuration error until the appropriate keys are supplied. Database
operations use the caller's verified Supabase access token with the public
key, so PostgreSQL row-level security remains active. The secret key is used
only by the backend health check and must never be used for ordinary user
operations. Check connectivity with `npm run db:check --prefix backend` or
`GET /api/health/supabase`.

### Frontend variables

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:5000/api` | Public URL of the API prefix used by the shared Axios client. |
| `VITE_SUPABASE_URL` | Empty | Supabase project URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Empty | Supabase browser publishable key for Auth. |

Vite embeds every `VITE_` variable into browser assets. Only the Supabase
publishable key may be exposed; never put `SUPABASE_SECRET_KEY`, a service-role
key, a database URL, or any other secret in a `VITE_` variable. Axios uses a
ten-second request timeout.

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
`SUPABASE_SECRET_KEY` exclusively in the backend runtime.

Supabase Auth is prepared for browser sign-in, and protected farm endpoints
verify access tokens before issuing requests scoped to the user's RLS role.
Apply the SQL migration described in
[Supabase setup](SUPABASE_SETUP.md) before using persisted operations.
