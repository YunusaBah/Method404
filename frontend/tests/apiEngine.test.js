import { describe, expect, it } from 'vitest'
import { createApiEngine, EngineError } from '../src/engine/api'

const profile = {
  cellId: 'basse',
  districtId: 'basse',
  soil: 'sandy',
  soilIsDefault: false,
  water: 'rainfed',
  priorities: ['income'],
  history: [],
  seasons: 3,
}

function fakeFetch(respond) {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) })
    return respond(url, init)
  }
  return { calls, fetchImpl }
}

describe('API engine', () => {
  it('lists the districts and finds the nearest one inside The Gambia', () => {
    const engine = createApiEngine({ baseUrl: 'http://api.test/api', fetchImpl: async () => null })

    expect(engine.districts()).toHaveLength(8)
    expect(engine.nearestCell(13.31, -14.22)).toEqual({ cellId: 'basse', districtId: 'basse' })
    // Dakar, Senegal is outside the coverage.
    expect(engine.nearestCell(14.69, -17.44)).toBeNull()
  })

  it('posts the farm, scenario and pins to the backend engine', async () => {
    const plan = { status: 'ok', best: { slots: [] }, alternatives: [], reasons: [] }
    const { calls, fetchImpl } = fakeFetch(() => Response.json(plan))
    const engine = createApiEngine({ baseUrl: 'http://api.test/api/', fetchImpl })

    await expect(engine.plan(profile, { dTempC: 1, dRainPct: -10 }, { 1: 'maize' })).resolves.toEqual(plan)
    expect(calls[0].url).toBe('http://api.test/api/gambia/engine/plan')
    expect(calls[0].init.method).toBe('POST')
    expect(calls[0].body.profile).toMatchObject({ cellId: 'basse', soil: 'sandy', priorities: ['income'] })
    expect(calls[0].body.profile.soilIsDefault).toBeUndefined()
    expect(calls[0].body).toMatchObject({ scenario: { dTempC: 1, dRainPct: -10 }, fixed: { 1: 'maize' } })

    await engine.slotOptions(profile, { dTempC: 0, dRainPct: 0 }, 2)
    expect(calls[1].url).toBe('http://api.test/api/gambia/engine/slot-options')
    expect(calls[1].body.slot).toBe(2)
  })

  it('turns server and network failures into engine errors', async () => {
    const failing = createApiEngine({
      baseUrl: 'http://api.test/api',
      fetchImpl: async () => Response.json({ error: { code: 'POWER_TIMEOUT', message: 'NASA POWER timed out.' } }, { status: 504 }),
    })
    await expect(failing.plan(profile, { dTempC: 0, dRainPct: 0 })).rejects.toMatchObject({
      name: 'EngineError',
      status: 504,
      code: 'POWER_TIMEOUT',
    })

    const offline = createApiEngine({
      baseUrl: 'http://api.test/api',
      fetchImpl: async () => { throw new TypeError('Failed to fetch') },
    })
    await expect(offline.plan(profile, { dTempC: 0, dRainPct: 0 })).rejects.toBeInstanceOf(EngineError)
  })
})
