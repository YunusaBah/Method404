import { describe, expect, it } from 'vitest'
import { createMockEngine } from '../src/engine/mock'

const engine = createMockEngine()

const profile = {
  cellId: 'banjul',
  districtId: 'banjul',
  soil: 'sandy',
  soilIsDefault: true,
  water: 'rainfed',
  priorities: ['soil', 'water'],
  history: [],
  seasons: 3,
}

const calm = { dTempC: 0, dRainPct: 0 }

describe('mock engine', () => {
  it('returns the same plan for the same farm and scenario', async () => {
    const first = await engine.plan(profile, calm, {})
    const second = await engine.plan(profile, calm, {})
    expect(first).toEqual(second)
  })

  it('builds three seasons with ten outcomes each', async () => {
    const result = await engine.plan(profile, calm, {})
    expect(result.status).toBe('ok')
    expect(result.best.slots).toHaveLength(3)
    for (const slot of result.best.slots) {
      expect(slot.outcomes).toHaveLength(10)
      expect(slot.rainWeekly.length).toBeGreaterThan(0)
      expect(['ok', 'low']).toContain(slot.confidence)
    }
  })

  it('refuses to rank crops without a soil', async () => {
    const result = await engine.plan({ ...profile, soil: 'unknown' }, calm, {})
    expect(result.status).toBe('insufficient')
    expect(result.missing).toContain('soil')
  })

  it('keeps a pinned crop in its slot', async () => {
    const result = await engine.plan(profile, calm, { 1: 'rice' })
    expect(result.status).toBe('ok')
    expect(result.best.slots[1].crop).toBe('rice')
    expect(result.best.slots[1].pinned).toBe(true)
    expect(result.best.slots[0].pinned).toBe(false)
  })

  it('offers alternatives that differ from the best plan', async () => {
    const result = await engine.plan(profile, calm, {})
    const best = result.best.slots.map((slot) => slot.crop).join('-')
    expect(result.alternatives.length).toBeGreaterThan(0)
    for (const alternative of result.alternatives) {
      expect(alternative.slots.map((slot) => slot.crop).join('-')).not.toBe(best)
    }
  })

  it('gets worse when the rains fail', async () => {
    const normal = await engine.plan(profile, calm, {})
    const dry = await engine.plan(profile, { dTempC: 0, dRainPct: -40 }, {})
    const count = (result) => result.best.slots
      .flatMap((slot) => slot.outcomes)
      .filter((outcome) => outcome === 'good').length
    expect(count(dry)).toBeLessThanOrEqual(count(normal))
    expect(dry.hypothetical).toBe(true)
  })

  it('offers up to three other crops for a slot', async () => {
    const options = await engine.slotOptions(profile, calm, 0, {})
    expect(options.length).toBeGreaterThan(0)
    expect(options.length).toBeLessThanOrEqual(3)
    expect(new Set(options.map((option) => option.crop)).size).toBe(options.length)
  })

  it('finds the nearest district and rejects far away points', () => {
    expect(engine.nearestCell(13.4549, -16.579)).toEqual({
      cellId: 'banjul',
      districtId: 'banjul',
    })
    expect(engine.nearestCell(0, 0)).toBeNull()
  })

  it('lists the districts with their default soil', () => {
    const districts = engine.districts()
    expect(districts.length).toBeGreaterThan(5)
    expect(districts.find((district) => district.id === 'brikama').defaultSoil).toBeNull()
  })
})
