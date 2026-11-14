# FarmShift — front end

A decision-support tool that helps smallholder farmers in The Gambia choose a
three-season crop rotation using NASA Earth observations, local soil, crop
characteristics and the farmer's own priorities.

This folder is the **front end only**. It runs against a deterministic mock of
the agronomy engine, so the whole flow can be built, demoed and tested offline.

- React 18 + Vite, **plain JavaScript** (`.js` / `.jsx`, no TypeScript)
- Hand-written CSS in one stylesheet (`src/styles/tokens.css`) — **no Tailwind**
- Offline-first PWA (`vite-plugin-pwa`, service worker precaches the shell)
- HashRouter, so it can be served from any static path

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server on http://localhost:5173
npm run build        # production build into dist/
npm run preview      # serve the built app
npm run lint         # eslint
npm run test         # vitest unit tests (jsdom)
npm run e2e          # playwright, builds and previews automatically
```

The Playwright project uses the installed Google Chrome (`channel: 'chrome'`),
so no browser download is needed.

## Using the mock

The mock is the default engine:

```js
// src/engine/index.js
export const usingMock = import.meta.env.VITE_USE_MOCK !== 'false'
```

To point the UI at a real engine, set `VITE_USE_MOCK=false` and swap the
`createMockEngine()` call for the real implementation. The contract the engine
has to satisfy is documented in `src/engine/contract.js` (JSDoc typedefs) and
was the only thing the UI was built against:

```js
engine.plan(profile, scenario, fixed)   // -> { status: 'ok' | 'insufficient', ... }
engine.slotOptions(profile, scenario, slot, fixed)
engine.districts()
engine.nearestCell(lat, lon)
```

While the mock is selected the console prints
`[FarmShift] MOCK DATA: the agronomy engine is not connected.` and the Numbers
sheet shows a `MOCK DATA` banner.

## Bundle

Initial payload of the production build (gzip):

| File | Size (gzip) |
| --- | --- |
| JavaScript | <!--JS--> |
| CSS | <!--CSS--> |

Budget was 200 KB gzipped for initial JavaScript.

## How the screens fit together

| Route | Screen | What it asks |
| --- | --- | --- |
| `/setup/location` | Location | "Where is your farm?" — geolocation or a district list |
| `/setup/soil` | Soil | "What happens when you squeeze your soil?" — four pictures |
| `/setup/water` | Water | "How do you water your crops?" |
| `/setup/priorities` | Priorities | "What matters to you?" — pick up to three |
| `/` | Plan | the recommended rotation, its alternatives, and the sheets |

The plan is a stack of three seasons. Each season shows the crop glyph, ten
outcome squares (one per past season: filled = good, left half = poor, outline =
failed), a monochrome weekly rain strip, and a plain sentence — "Good in 6 of 10
past seasons".

Four sheets hang off the plan:

- **Change this season** — up to three alternatives, or "Let the app choose".
- **Why this plan** — at most three reasons, in words, with a Listen button.
- **What if…** — rain −40…+20 % and heat 0…+3 °C, marked "Imagined, not a forecast".
- **Numbers** — the underlying rows with an Observed / Derived / Modeled tag.

Every sheet pushes a history entry, so the Android back button closes the sheet
instead of leaving the plan.

## Design constraints that were kept

- White paper, one accent (`#1B5E20`), hairline rules, no shadows, no gradients,
  no border radius.
- Helvetica (`Helvetica, "Helvetica Neue", Arial, sans-serif`) at 18 px minimum.
- 480 px maximum content width, 48 px minimum touch targets.
- Six taps from a cold start to the first plan (the e2e test counts them).
- Reduced motion turns the rain strip animation off.
- No hardcoded user-facing strings: everything goes through `t(key, params)`,
  and a unit test fails if a literal appears in JSX text or in an
  `aria-label` / `placeholder` / `alt` / `title`, or if a `t('…')` key is
  missing from `src/i18n/en.json`.

## Languages

`en.json` is complete. `mnk.json` (Mandinka), `wo.json` (Wolof) and `ff.json`
(Pulaar) are intentionally empty — every key falls back to English, so the
language switch is already wired and only needs translation work.

Audio uses `speechSynthesis` first and falls back to recorded clips at
`/audio/{lang}/{key}.mp3` when a clip exists. If the device has no voice for the
language, the Listen button is not rendered at all.

## Assumptions

1. **Mock, not science.** The scoring, the ten-year outcome record and the rain
   strip are generated from a seeded hash of the farm profile. The numbers are
   plausible and stable, but they are not agronomy and they are not NASA data.
2. **The Gambia only.** The eight districts, their coordinates and their default
   soil come from the mock. `nearestCell` returns `null` beyond 250 km.
3. **Two districts have no default soil** (Brikama, Basse) — the farmer is sent
   to the soil step instead of getting a guess.
4. **Irrigation is out of scope.** Choosing "I irrigate" is accepted and then
   flagged on the plan: "Irrigated farms are not covered yet."
5. **JavaScript, not TypeScript.** The engine contract lives in JSDoc typedefs
   and the type gate was replaced by ESLint plus the i18n/string tests. Tailwind
   was removed as well; layout is plain CSS with semantic class names.
6. **Crop glyphs and soil diagrams are placeholders** (`// PLACEHOLDER` in the
   source) and should be replaced with commissioned drawings.
7. **No backend calls from this UI.** The Express proxy and the NASA POWER
   integration in `/backend` are untouched by this build.

## Layout

```
src/
  engine/       mock engine, contract (JSDoc), engine selector
  state/        tiny external store persisted to IndexedDB
  i18n/         dictionaries + t(key, params)
  audio/        speech synthesis and clip playback
  components/   sheet, stepper, outcome squares, rain strip, glyphs
  screens/      location, soil, water, priorities, plan
  styles/       tokens.css — the only stylesheet
tests/          vitest: engine, i18n, strings, components
e2e/            playwright: six-tap path, back button closes a sheet
```
