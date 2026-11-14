# FarmShift AI — METHOD404

FarmShift AI is an agricultural decision-support project for exploring environmental context for crop planning. The initial target region is The Gambia. Its React dashboard reads live climate, vegetation, terrain, crop-suitability and satellite catalogue data for locations in The Gambia. It also includes NASA POWER endpoints and Supabase-backed farm and climate-observation APIs; hosted persistence requires the Supabase schema migration to be applied.

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

Open the Vite URL printed in the frontend terminal (normally `http://localhost:5173`). The frontend has two pages:

- **Farmer app** (`/`): the step-by-step rotation planner (location, soil, water, priorities), in English, Mandinka, Wolof and Pulaar. Its plans come from the backend engine, which uses ten years of NASA POWER daily rainfall and temperature plus FAO GAEZ suitability. Set `VITE_USE_MOCK=true` in `frontend/.env` to work on the UI without the backend.
- **Data explorer** (`/data.html`): the dashboard, Climate Insights, Crop Recommendations, Crop Rotation Planner and Environmental Data pages, showing every NASA and partner data source.

On macOS, port 5000 is often taken by the AirPlay Receiver; the launcher then uses port 5001 and points the frontend at it automatically.

## Configuration

Backend settings are loaded from `backend/.env`. The repository includes an ignored development configuration; use `backend/.env.example` as the template for a fresh checkout. Production requires `CLIENT_URL` and `CORS_ORIGINS` to be set explicitly to exact frontend origins. Unlisted browser origins are rejected in production. Requests without an `Origin` header (for example, command-line health checks) are allowed.

Copy `frontend/.env.example` to `frontend/.env` to set `VITE_API_BASE_URL`; it defaults to `http://localhost:5000/api`. Configure the Supabase project URL and publishable key for browser Auth. Vite variables prefixed with `VITE_` are included in browser code, so only public configuration belongs there; never put a secret key in a `VITE_` variable.

The backend health check is available at `GET /api/health`. NASA POWER daily point data and summaries are available at `GET /api/nasa/power` and `GET /api/nasa/power/summary`; all 13 data sources for locations in The Gambia are available under `GET /api/gambia/data/:sourceId`. `GET /api/health/supabase` checks the hosted Supabase Data API and `profiles` table, while authenticated farm and climate endpoints use the caller's Supabase access token and database RLS. See [Supabase setup](documentation/SUPABASE_SETUP.md), [API configuration](documentation/API_CONFIGURATION.md), [data sources](documentation/DATA_SOURCES.md), and [environment setup](documentation/ENVIRONMENT_SETUP.md) for details.

## Quality checks

```powershell
cd backend
npm test
cd ..\frontend
npm run lint
npm run build
```

## Current scope

Climate Insights, Crop Recommendations, the Crop Rotation Planner and Environmental Data use live data. Supabase farm persistence is available after applying the hosted schema migration. The interface does not present simulated or sample values as NASA observations.
