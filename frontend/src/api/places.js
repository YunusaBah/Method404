// Place lookup. The backend does the phonetic matching; this module only
// handles transport and the offline fallback to the eight districts we ship.

import { findDistrict, nearestDistrict } from '../data/districts'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')
const TIMEOUT_MS = 8_000

function localMatches(queries) {
  const matches = []
  for (const query of queries) {
    const district = findDistrict(query)
    if (district) {
      matches.push({ ...district, region: district.name, score: 100, exact: true })
    }
  }
  return matches
}

/**
 * @param {string|string[]} query one transcript, or several alternatives
 * @returns {Promise<Array<{id,name,region,lat,lon,score,exact}>>}
 */
export async function suggestPlaces(query) {
  const queries = (Array.isArray(query) ? query : [query])
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .slice(0, 5)

  if (queries.length === 0) return []

  const params = new URLSearchParams()
  for (const value of queries) params.append('q', value)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${BASE_URL}/places?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error('places_unavailable')
    const body = await response.json()
    return body.matches ?? []
  } catch {
    return localMatches(queries)
  } finally {
    clearTimeout(timer)
  }
}

export { nearestDistrict }
