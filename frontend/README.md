# FarmShift — front end

A farmer types or speaks the name of their district. The page reads three years
of NASA rainfall and temperature for that point, ranks the crops that will grow
there, shows the weather behind the answer, and lays the result out as a
month-by-month planting calendar. They choose how many years ahead to plan, can
describe their soil and say what matters most to them, and then compare two
rotations year by year to see which one is kinder to the soil.

## Stack

- React 18 + Vite, **plain JavaScript** (`.js` / `.jsx`, no TypeScript)
- Hand-written CSS in one stylesheet (`src/styles/app.css`) — **no Tailwind**
- `react-router-dom` (HashRouter) with five sections
- Helvetica, full-width layout, one green accent
- Offline-first PWA (`vite-plugin-pwa`), last answer cached in IndexedDB
- Voice in (Web Speech recognition) and voice out (`speechSynthesis`)

## Running it

The page needs the Express API, which is the only thing that talks to NASA.

```bash
# terminal 1 — API on :5000
cd backend && npm install && npm start

# terminal 2 — front end on :5173 (proxies /api to :5000)
cd frontend && npm install && npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | dev server on http://localhost:5173 |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve `dist/` (proxies `/api` to :5000) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run e2e` | Playwright, builds and previews automatically |

`VITE_API_BASE_URL` overrides the API root (default `/api`). Playwright uses the
installed Google Chrome (`channel: 'chrome'`), so no browser download is needed.

## The five sections

| Route | Section | What it answers |
| --- | --- | --- |
| `/` | Home | "Where is my field?" → today's weather, the three best crops, a way into rotations |
| `/weather` | Weather | "What is the weather here, and when does rain come?" |
| `/crops` | Crops | "Which crops fit, and in which months?" |
| `/plan` | Planting | "What do I plant each month, this year and the years ahead?" |
| `/rotation` | Rotations | "In what order should I plant across years to protect my soil?" |

On a phone the sections sit in a fixed tab bar at the bottom, within thumb
reach. From 900 px they move into a sticky row under the header. The chosen
field, the soil, the priority and the planning horizon are shared by every
section, so they are only entered once and survive a reload.

### Planning horizon

Planting and Rotations share one control: **how far ahead do you want to plan?**
It offers two, three or four years, and both screens follow it.

- **Planting** shows this year as the full month-by-month calendar. Later years
  use the same typical pattern, so they are summarised as sowing windows with
  their top crops and a "+n more" count instead of repeating the calendar.
- **Rotations** turns one season into one year (The Gambia has a single rainy
  growing season), so a two- to four-year horizon builds a two- to four-year
  rotation. Changing the horizon rebuilds the suggested plans; a crop edit made
  for a different horizon is dropped rather than half-applied.

The data is a recent average, not a year-by-year forecast, and both screens say
so in plain words. The horizon is a planning rhythm for seed, land and labour —
never a promise about next year's rain.

## Fitting the challenge (frontend only)

The NASA Space Apps brief asks for NASA observations **plus local soil
information, crop characteristics and farmer priorities**, used to explore
**rotation strategies that strengthen soil health**. Only the first and third of
those come from the API. The rest is deliberately done in the browser, so the
front end can tell the whole story without a new endpoint:

- `src/data/catalogue.json` — a generated copy of the backend's 19-crop
  catalogue. `src/data/traits.js` reads the rotation traits from it, so the
  catalogue is written once and both sides agree.
- `src/lib/rotation.js` — pure functions: `soilFit`, `rankCrops` (re-orders the
  API ranking for the chosen soil and priority) and `scorePlan` (scores an
  ordered list of years on soil health, water, variety and speed).
- `src/components/FieldSetup.jsx` — three soil buttons (sandy / loam / clay) and
  four priorities (best harvest / save water / build soil / quick harvest).
- `src/lib/planning.js` — the shared horizon: how many years ahead to plan,
  plus the sowing windows used to summarise later years.
- `src/routes/Rotation.jsx` + `PlanCard.jsx` — two editable plans of two to four
  years, live bars, plain-language reasons, and a short explanation of why
  rotating families and roots protects the soil.

The scores are **relative teaching signals**, not an agronomic model: the screen
says so in plain words and points the farmer to their extension officer. Nothing
in the rotation planner invents weather data — it uses the same crop list and
rain reading the API already returned.

## The API

```
GET /api/recommend?lat=&lon=&district=   ranked crops + month suitability
GET /api/weather?lat=&lon=               current conditions + a typical year
GET /api/places?q=caravan&q=kerewan      place lookup, several transcripts at once
GET /api/crops?category=&scored=         the 19-crop catalogue, with photo credits
GET /api/crops/:id                       one crop
```

All five are served by Express; only the backend talks to NASA POWER. The
catalogue is reference data, so the front end falls back to a bundled copy when
`/api/crops` is unreachable — the first visit works offline.

### Making dictation understand Gambian names

Speech recognition is trained on American and British English, so "Kerewan"
comes back as "caravan" and "Basse Santa Su" as "bass santa sue". The front end
asks the recogniser for up to five alternatives and sends all of them to
`/api/places`, which compares what was heard with how each place sounds:

1. `normalise` lowercases, strips punctuation and drops filler words, so
   "I live in Kerewan" becomes `kerewan`.
2. `soundKey` reduces a name to its consonant skeleton and folds the spellings
   that vary — `ph→f`, `ck→k`, `c→k`, `z→s`, doubled letters collapse, vowels
   drop. `kerewan` → `krwn`, `caravan` → `krvn`.
3. Each name and alias is scored: exact 100, same skeleton 90, a prefix 80,
   one or two literal edits 80–74, a near-skeleton 74. A misheard name almost
   never loses its first consonant, so that is required — it stops "Dakar"
   turning into "Kaur" or "Bakau".
4. Anything outside the gazetteer scores zero and the page says it could not
   find the place instead of guessing.

The gazetteer in `backend/src/data/places.js` holds the eight local government
areas plus 26 towns, with the spellings people type, the colonial names still in
use (Bathurst, Georgetown) and the mangled forms the recogniser produces.

The same lookup powers the type-ahead, so "brik" already suggests Brikama.

## What the screens show

- **Month strip** — twelve cells, `J F M A M J J A S O N D`. Filled green =
  good, half-filled = possible, outline = not suitable, ring on the best month.
  Every cell is a `listitem` with an `aria-label` such as "July: Good".
- **Weather that suits it** — rain in the best month against the crop's need,
  the average high against its heat limit, the longest dry spell, sowing month.
- **Current weather** — the latest NASA reading for the point: high, low, rain,
  humidity.
- **Weather through the year** — twelve horizontal rain bars with the average
  high beside each one, and a sentence naming the wet and dry seasons.
- **Planting calendar** — one row per month with something to sow; consecutive
  empty months fold into a single range (`January – May`, "11 mm over 5 months").
  Crops are ranked within a row, with the best marked and the current month
  highlighted. The horizon adds later years as compact sowing windows.
- **Crop catalogue** — all 19 crops and fruits, grouped into field crops and
  orchard crops, each with a real photograph, its scientific name, whether it is
  ranked for this field, and the photo credit. Orchard crops are shown for
  recognition but kept out of the monthly plan and rotations because they are
  perennial.
- **Soil and priorities** — a compact panel on Home, Crops and Rotations. It
  re-orders the crop list and adds a "Suits your soil" / "May struggle in your
  soil" tag; it never changes the NASA reading.
- **Rotation comparison** — two plans of two to four years, each year a crop
  picker with its photograph. Soil health, water, variety and speed bars move as
  the farmer changes the order or the horizon, and every plan explains itself in
  sentences ("A legume before a cereal feeds the next crop").

## Crop photographs

`scripts/photo-sources.json` lists one curated Wikimedia Commons file per crop.
The sources were chosen by eye from candidate contact sheets, never auto-picked.
`npm run images` then:

1. resolves each Commons file through the API (with retry/backoff on `429`),
2. draws it to a canvas in headless Chrome and writes a **1280×960** WebP at
   quality 0.90 plus a **320×240** thumbnail at 0.86,
3. writes `public/crops/CREDITS.md` and `backend/src/data/photo-credits.json`,
4. copies `backend/src/data/crops.json` to `src/data/catalogue.json`.

`--force=id,id` regenerates only those crops; a run is resumable, so a partial
batch never refetches what already exists. The images are committed, so the app
itself needs neither the script nor the network.

## Languages

The menu lists English, Mandinka, Wolof and Pulaar by their own names. Wolof
and Pulaar have draft translations that need review by native speakers.
Mandinka falls back to English and carries an `EN` badge because no reliable
translation source is available yet. `document.documentElement.lang` and the
speech voice follow the selection, and it survives a reload.

## Location

“Use my location” requests a fresh, high-accuracy browser GPS fix, uses those
coordinates for the weather and crop data, and labels the field with the
nearest Gambian district. Browsers require HTTPS (or localhost) and location
permission. If location is unavailable or times out, the page explains why and
still lets the farmer choose a district manually.

## Voice and offline

- The microphone uses `SpeechRecognition` with `maxAlternatives: 5`; the button
  is disabled where the browser has no support, so typing always works.
- Listen buttons are only rendered when the device has a voice for the selected
  language. English uses `en-GB`, Wolof and Pulaar `fr-FR`.
- The last answer per field is cached in IndexedDB. If the network fails, the
  cached answer is shown with "Saved answer — you are offline." The shell is
  precached by the service worker; crop photographs are cached on first view.

## Bundle

Production build, initial payload:

| File | Raw | Gzip |
| --- | --- | --- |
| JavaScript | 232.9 KB | **74.9 KB** |
| workbox-window | 5.7 KB | 2.2 KB |
| CSS | 27.7 KB | **5.9 KB** |

The photographs are not in that figure: they are separate files cached at
runtime. There are 19 large images (1280×960, roughly 100–350 KB each) and 19
thumbnails (320×240, roughly 20–40 KB each), about 5.2 MB in total; the small
size is what the catalogue grid and plan cards load first.

## Tests

| Suite | Covers |
| --- | --- |
| `tests/districts.test.js` | name matching, GPS snapping, coordinates in range |
| `tests/api.test.js` | request shape, API error codes, offline fallback, normalising |
| `tests/i18n.test.js` | fallback to English, parameter filling, months and statuses |
| `tests/strings.test.js` | no hardcoded user-facing text, no missing dictionary keys |
| `tests/components.test.jsx` | month strip, crop facts, planting calendar, language menu (jsdom) |
| `tests/render.test.jsx` | server-rendered calendar ranges and soil-fit chips, no DOM needed |
| `tests/calendar.test.js` | folding empty months into ranges, never losing a month |
| `tests/planning.test.js` | horizon clamping, sowing windows, year labels, plans of N years |
| `tests/rotation.test.js` | soil fit, priority ranking, rotation scores, notes, suggested plans |
| `tests/catalogue.test.js` | the bundled catalogue matches the API shape, 19 crops, 7 scored |
| `e2e/first-result.spec.js` | three taps to an answer, sections, calendar, language, soil, rotations |

The backend has its own suite (`cd backend && npm test`, 101 tests), covering the
scoring model, the weather aggregation, the place matcher and the crop
catalogue.

On a heavily loaded machine Vitest's worker can time out while jsdom starts
("Timeout waiting for worker to respond"). The node-environment suites and
`tests/render.test.jsx` do not need that worker, so they still give full coverage
of the calendar and rotation logic when it happens.

## Assumptions

1. **The Gambia only.** Eight districts and 26 towns with fixed coordinates; a
   GPS fix is snapped to the nearest district.
2. **NASA POWER is the only climate source.** If it is unreachable the API
   returns 502 and the page falls back to the cached answer, if there is one.
3. **Rainfall is the water model.** The API has no irrigation, slope or
   groundwater. Soil is described by the farmer in the browser, not measured;
   the rotation scores are a relative guide built from crop families.
4. **Crop constants are coarse.** Water need, season length and heat limit come
   from FAO/IITA summaries in `backend/src/data/crops.json`; the extra rotation
   traits sit beside them in the same catalogue. Only the seven crops with
   reviewed constants enter the core recommendation and rotation models.
   Separate estimated climate profiles are available for the other featured
   crops and are not validated planting advice.
5. **Photographs are real, and credited.** The 19 crop photos are curated
   Wikimedia Commons files, converted at build time to two WebP sizes by
   `scripts/fetch-crop-images.mjs`. Several are CC BY-SA, so the author, licence
   and source are shipped in `public/crops/CREDITS.md` and in `/api/crops`.
6. **The language menu is honest about its gaps.** Wolof and Pulaar are draft
   translations; Mandinka falls back to English until a reliable translation is
   available.

## Layout

```
src/
  api/          recommend, weather, places and crops clients, with cache + errors
  context/      AppDataProvider — one fetch per field, shared by every route
  data/         districts, generated catalogue, crop photo paths, rotation traits
  speech/       Web Speech dictation with alternatives
  audio/        speechSynthesis playback
  state/        tiny external store persisted to IndexedDB
  i18n/         dictionaries + translate(language, key, params)
  lib/          error messages, month grouping, planning horizon, rotation scoring
  components/   header, nav, location form, field setup, horizon picker, crop
                card, catalogue grid, plan card, month strip, calendar, year summary
  routes/       Home, Weather, Crops, Calendar, Rotation
  styles/       app.css — the only stylesheet
scripts/        photo-sources.json + fetch-crop-images.mjs
tests/          vitest
e2e/            playwright
```
