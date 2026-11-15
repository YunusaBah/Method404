// Talks to the Express backend, which fetches NASA POWER daily rainfall and
// temperature for the point and ranks the crops. Nothing here computes
// agronomy: the browser only renders what the API returns.

import { loadValue, saveValue } from '../persistence/db'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')
const TIMEOUT_MS = 25_000

export class RecommendError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'RecommendError'
    this.code = code
  }
}

function cacheKey(lat, lon) {
  return `farmshift.recommend.${lat.toFixed(2)}.${lon.toFixed(2)}`
}

/**
 * @param {{lat:number, lon:number, district?:string}} place
 * @returns {Promise<object>} the API payload
 */
export async function fetchRecommendation(place) {
  const params = new URLSearchParams({
    lat: String(place.lat),
    lon: String(place.lon),
  })
  if (place.district) params.set('district', place.district)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${BASE_URL}/recommend?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      let code = 'upstream_unavailable'
      try {
        const body = await response.json()
        code = body?.error?.code ?? code
      } catch {
        // A non-JSON body is still an upstream failure.
      }
      throw new RecommendError(code)
    }

    const data = await response.json()
    void saveValue(cacheKey(place.lat, place.lon), { data, savedAt: Date.now() })
    return data
  } catch (error) {
    if (error instanceof RecommendError) throw error

    const cached = await loadValue(cacheKey(place.lat, place.lon))
    if (cached?.data) return { ...cached.data, cached: true }

    if (error.name === 'AbortError') throw new RecommendError('timeout')
    throw new RecommendError('offline')
  } finally {
    clearTimeout(timer)
  }
}

/** The payload the UI expects, for tests and the offline first paint. */
export function normalise(payload) {
  return {
    location: payload.location ?? { latitude: 0, longitude: 0, district: null },
    climate: payload.climate ?? [],
    crops: payload.crops ?? [],
    period: payload.period ?? null,
    cached: Boolean(payload.cached),
  }
}
