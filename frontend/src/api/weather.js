// Current conditions and a typical year for a point.

import { loadValue, saveValue } from '../persistence/db'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')
const TIMEOUT_MS = 25_000

export class WeatherError extends Error {
  constructor(code) {
    super(code)
    this.name = 'WeatherError'
    this.code = code
  }
}

function cacheKey(lat, lon) {
  return `farmshift.weather.${lat.toFixed(2)}.${lon.toFixed(2)}`
}

export async function fetchWeather(place) {
  const params = new URLSearchParams({ lat: String(place.lat), lon: String(place.lon) })
  if (place.district) params.set('district', place.district)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${BASE_URL}/weather?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      let code = 'upstream_unavailable'
      try {
        const body = await response.json()
        code = body?.error?.code ?? code
      } catch {
        // Keep the generic code.
      }
      throw new WeatherError(code)
    }

    const data = await response.json()
    void saveValue(cacheKey(place.lat, place.lon), { data, savedAt: Date.now() })
    return data
  } catch (error) {
    if (error instanceof WeatherError) throw error

    const cached = await loadValue(cacheKey(place.lat, place.lon))
    if (cached?.data) return { ...cached.data, cached: true }

    if (error.name === 'AbortError') throw new WeatherError('timeout')
    throw new WeatherError('offline')
  } finally {
    clearTimeout(timer)
  }
}
