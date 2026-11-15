// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { clampHorizon, HORIZONS, sowingWindows, yearKey } from '../src/lib/planning'
import { suggestedPlans } from '../src/lib/rotation'
import { climate, cowpea, maize, millet } from './fixtures'

describe('clampHorizon', () => {
  it('keeps the horizon inside the offered years', () => {
    expect(clampHorizon(1)).toBe(2)
    expect(clampHorizon(2)).toBe(2)
    expect(clampHorizon(3)).toBe(3)
    expect(clampHorizon(9)).toBe(4)
    expect(clampHorizon('nope')).toBe(2)
  })
})

describe('sowingWindows', () => {
  it('lists only the months with something to sow', () => {
    const windows = sowingWindows([cowpea, millet], climate)

    expect(windows.length).toBeGreaterThan(0)
    expect(windows.every((window) => window.crops.length > 0)).toBe(true)
    expect(windows[0].from).toBe(6)
    expect(windows[0].to).toBe(6)
  })

  it('trims the crops and reports how many are hidden', () => {
    const [window] = sowingWindows([cowpea, millet], climate, 1)

    expect(window.crops).toHaveLength(1)
    expect(window.extra).toBeGreaterThanOrEqual(0)
  })

  it('returns nothing when no month suits the crops', () => {
    const never = { ...cowpea, months: cowpea.months.map((month) => ({ ...month, status: 'poor' })) }
    expect(sowingWindows([never], climate)).toEqual([])
  })
})

describe('yearKey', () => {
  it('names this year, next year and later years', () => {
    expect(yearKey(0)).toBe('plan.year.this')
    expect(yearKey(1)).toBe('plan.year.next')
    expect(yearKey(3)).toBe('plan.year.plus')
  })
})

describe('suggestedPlans over a horizon', () => {
  it('builds a plan of exactly the chosen number of years', () => {
    for (const years of HORIZONS) {
      const [a, b] = suggestedPlans([cowpea, millet, maize], years)
      expect(a).toHaveLength(years)
      expect(b).toHaveLength(years)
    }
  })

  it('still starts the rotation with a legume', () => {
    const [a] = suggestedPlans([cowpea, millet, maize], 4)
    expect(a[0].id).toBe('cowpea')
  })
})
