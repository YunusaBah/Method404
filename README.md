# FarmShift AI — METHOD404

FarmShift AI is an agricultural decision-support project for exploring environmental context for crop planning. The initial target region is The Gambia. The current dashboard is a frontend foundation; NASA data, crop recommendations, and Supabase persistence are not yet integrated.

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

Copy `backend/.env.example` to `backend/.env` to configure the server. `PORT` defaults to `5000`; `CORS_ORIGINS` is an optional comma-separated allowlist for deployment. In development, local HTTP origins such as `http://localhost:5173` are allowed so Vite can select another port if its default is busy. In production, set `CORS_ORIGINS` to the exact frontend origin(s). Requests without an `Origin` header (for example, command-line health checks) are allowed.

Copy `frontend/.env.example` to `frontend/.env` to set `VITE_API_BASE_URL`. It defaults to `http://localhost:5000`. `VITE_PORT` can be set in the shell to choose Vite's starting port. Vite variables prefixed with `VITE_` are included in browser code, so use this setting only for public configuration; never put credentials or secrets in it.

The backend health check is available at `GET /api/health`.

## Quality checks

```powershell
cd backend
npm test
cd ..\frontend
npm run lint
npm run build
```

## Current scope

Climate insights, crop recommendations, crop rotation planning, environmental observations, and Supabase are placeholders or future integrations. The interface does not present simulated or sample values as NASA observations.
