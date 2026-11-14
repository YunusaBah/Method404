# FarmShift AI — METHOD404

FarmShift AI is an agricultural decision-support project for exploring environmental context for crop planning. The initial target region is The Gambia. The dashboard reads live climate, vegetation, terrain, crop-suitability and satellite data for locations in The Gambia; crop rotation planning and Supabase persistence are not yet integrated.

## Requirements

- Node.js 20.19+ or 22.12+ (required by the installed Vite version)
- npm

## Run locally

Install dependencies once in each project:

```powershell
cd backend
npm install
cd ..\frontend
npm install
```

Start the backend and frontend together from the repository root:

```powershell
npm run dev
```

This starts the API on port `5000` and Vite on port `5173` (or Vite's next available port if that port is in use). If the backend port is occupied, the launcher selects the next available port between `5001` and `5099` and configures the frontend to use it. Press `Ctrl+C` to stop both. To choose a specific backend port, set `PORT`; set `VITE_PORT` to choose a different starting frontend port.

You can also run only one service from the root with `npm run dev:backend` or `npm run dev:frontend`.

Open the Vite URL printed in the frontend terminal (normally `http://localhost:5173`). The dashboard checks the backend health endpoint and displays its connection state.

## Configuration

Backend settings are loaded from `backend/.env`. The repository includes an ignored development configuration; use `backend/.env.example` as the template for a fresh checkout. Production requires `CLIENT_URL` and `CORS_ORIGINS` to be set explicitly to exact frontend origins. Unlisted browser origins are rejected in production. Requests without an `Origin` header (for example, command-line health checks) are allowed.

Copy `frontend/.env.example` to `frontend/.env` to set `VITE_API_BASE_URL`; it defaults to `http://localhost:5000/api`. The shared Axios client uses a ten-second timeout and reports connection failures consistently. Vite variables prefixed with `VITE_` are included in browser code, so use this setting only for public configuration; never put credentials or secrets in it.

The backend health check is available at `GET /api/health`. NASA POWER daily point data is available through the validated `GET /api/nasa/power/daily` proxy, and all 13 data sources are available for locations in The Gambia under `GET /api/gambia/data/:sourceId`. Supabase is configured for a future integration only; there is no authentication or persistence yet. See [API configuration](documentation/API_CONFIGURATION.md) and [environment setup](documentation/ENVIRONMENT_SETUP.md) for details.

## Quality checks

```powershell
cd backend
npm test
cd ..\frontend
npm run lint
npm run build
```

## Current scope

Climate Insights, Crop Recommendations and Environmental Data use live data. Crop rotation planning and Supabase are placeholders or future integrations. The interface does not present simulated or sample values as NASA observations.
