// Shared planning horizon: how many years ahead the farmer wants to prepare.
//
// The weather we hold is a recent *typical* year, not a year-by-year forecast,
// so a longer horizon repeats the same pattern. The UI says that plainly: the
// extra years are for planning seed, land and labour, never a prediction.

import { groupMonths } from './calendar'

export const HORIZONS = [2, 3, 4]
export const DEFAULT_HORIZON = 2

/** Keeps a stored or clicked horizon inside the offered range. */
export function clampHorizon(value) {
  const years = Number(value)
  if (!Number.isFinite(years)) return DEFAULT_HORIZON
  return Math.min(HORIZONS[HORIZONS.length - 1], Math.max(HORIZONS[0], Math.round(years)))
}

/**
 * The sowing windows for one typical year, trimmed for a compact year summary.
 * Each window is a run of good months with its top crops and how many more
 * crops sit behind them.
 */
export function sowingWindows(crops, climate, limit = 3) {
  return groupMonths(crops, climate)
    .filter((row) => row.type === 'sow')
    .map((row) => ({
      from: row.from,
      to: row.to,
      rain: row.rain,
      crops: row.crops.slice(0, limit),
      extra: Math.max(0, row.crops.length - limit),
    }))
}

/** Dictionary key for the year at `offset` from now: 0 this year, 1 next. */
export function yearKey(offset) {
  if (offset <= 0) return 'plan.year.this'
  if (offset === 1) return 'plan.year.next'
  return 'plan.year.plus'
}
