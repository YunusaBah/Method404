// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchRecommendation, normalise, RecommendError } from '../src/api/recommend'
import { payload } from './fixtures'

afterEach(() => {
  vi.unstubAllGlobals()
})

function respond(body, { ok = true, status = 200 } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok,
      status,
      json: async () => body,
    })),
  )
}

describe('recommend client', () => {
  it('asks for the point and passes the district through', async () => {
    respond(payload)
    const data = await fetchRecommendation({ lat: 13.4549, lon: -16.579, district: 'Banjul' })

    const url = fetch.mock.calls[0][0]
    expect(url).toContain('/recommend?')
    expect(url).toContain('lat=13.4549')
    expect(url).toContain('lon=-16.579')
    expect(url).toContain('district=Banjul')
    expect(data.crops).toHaveLength(4)
  })

  it('surfaces the API error code so the page can explain it', async () => {
    respond({ success: false, error: { code: 'CLIMATE_UNAVAILABLE' } }, { ok: false, status: 502 })
    await expect(fetchRecommendation({ lat: 13.45, lon: -16.58 })).rejects.toMatchObject({
      code: 'CLIMATE_UNAVAILABLE',
    })
  })

  it('falls back to the offline code when the network dies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(fetchRecommendation({ lat: 1.234, lon: 5.678 })).rejects.toBeInstanceOf(RecommendError)
  })

  it('normalises a partial payload into the shape the UI renders', () => {
    expect(normalise({})).toEqual({
      location: { latitude: 0, longitude: 0, district: null },
      climate: [],
      crops: [],
      period: null,
      cached: false,
    })
  })
})
