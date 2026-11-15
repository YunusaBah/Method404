# FarmShift AI — METHOD404

FarmShift AI is an agricultural decision-support project for crop planning. The
initial target region is The Gambia. A farmer names their district; the API
fetches NASA POWER rainfall and temperature for that point and returns a ranked
list of crops with the months that suit each one.

## How it works

```
browser  ──POST /api/places?q=──▶  Express  ──▶  phonetic gazetteer
         ──GET  /api/weather?lat=&lon=──▶       ──▶  NASA POWER (current + monthly)
         ──GET  /api/recommend?lat=&lon=──▶     ──▶  NASA POWER (3-year climatology)
         ◀── climate + ranked crops ────
```

The front end is five screens behind a router: **Home** (place field with voice
dictation, then the ranked crops), **Weather** (the reading for today and the
twelve-month record for that point), **Crops** (the full catalogue of 19 crops
and fruits, with real photographs), **Planting** (what to sow each month, over a
horizon of two to four years) and **Rotations** (a soil and priority selector
plus two editable multi-year plans compared on soil health, water, variety and
speed). Each crop card carries a photograph, a twelve-cell month strip
(good / possible / not suitable) and the weather that makes the crop work.

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

The backend health check is available at `GET /api/health`. NASA POWER daily
point data is available through the validated `GET /api/nasa/power/daily` proxy,
and the crop recommendation the interface uses is `GET /api/recommend`.
`GET /api/weather` returns the latest day plus a twelve-month rainfall and
temperature record for the same point, and `POST /api/places` resolves a spoken
or typed Gambian place name to coordinates — it accepts several spellings at
once (`q` may be repeated) and returns them ranked, which is how voice input
recovers "Kerewan" from a recogniser that heard "caravan". `GET /api/crops`
serves the shared 19-crop catalogue (with photo credits), and the front end
keeps a bundled copy so the first visit works offline. Supabase
is configured for a future integration only; there is no authentication or
persistence yet. See [API configuration](documentation/API_CONFIGURATION.md) and
[environment setup](documentation/ENVIRONMENT_SETUP.md) for details.

## Quality checks

```powershell
cd backend
npm test
cd ..\frontend
npm run lint
npm run test
npm run build
```

## Current scope

Working today: NASA POWER climatology and a current reading for any point, a
seven-crop scoring model with month-level suitability, a 19-crop catalogue with
curated Wikimedia Commons photographs (two WebP sizes plus attribution), a
phonetic gazetteer of 34 Gambian places that voice input can reach, and the
five-screen interface with voice input, voice output and an offline cache. The
soil selector, farmer priorities, planning horizon and rotation planner live
entirely in the browser on local crop traits, so they need no new API. Not yet
done: measured soil data, irrigation, Supabase persistence, showing the
long-term climate *shift* rather than the current normal, and translation of the
Mandinka, Wolof and Fula dictionaries.
Where a value is modelled rather than observed, the API says so through the
`limiting` field and the UI explains it in plain words.
