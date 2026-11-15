/**
 * The real agronomy engine. Plans come from the FarmShift backend
 * (/api/gambia/engine), which replays each crop against the last ten rainy
 * seasons of NASA POWER daily rainfall and temperature, and adds FAO GAEZ
 * suitability. It satisfies the contract in ./contract.js.
 */

// District reference points. They must match backend/src/services/gambia/engine.js.
// Kept here because the contract's districts() and nearestCell() are synchronous.
export const DISTRICTS = [
  { id: 'banjul', name: 'Banjul', defaultSoil: 'sandy', lat: 13.4549, lon: -16.579 },
  { id: 'kanifing', name: 'Kanifing', defaultSoil: 'sandy', lat: 13.4432, lon: -16.6667 },
  { id: 'brikama', name: 'Brikama', defaultSoil: null, lat: 13.2667, lon: -16.65 },
  { id: 'mansakonko', name: 'Mansakonko', defaultSoil: 'loam', lat: 13.4667, lon: -15.6667 },
  { id: 'kerewan', name: 'Kerewan', defaultSoil: 'sandy', lat: 13.5, lon: -16.0833 },
  { id: 'kuntaur', name: 'Kuntaur', defaultSoil: 'clay', lat: 13.6667, lon: -14.8833 },
  { id: 'janjanbureh', name: 'Janjanbureh', defaultSoil: 'clay', lat: 13.5333, lon: -14.7667 },
  { id: 'basse', name: 'Basse', defaultSoil: null, lat: 13.3167, lon: -14.2167 },
]

// Farms further than this from every district headquarters are outside
// The Gambia's coverage.
const MAX_DISTANCE_KM = 120

// The first request for a district fetches ten years of NASA data.
const REQUEST_TIMEOUT_MS = 45000

export class EngineError extends Error {
  constructor(message, { status, code } = {}) {
    super(message)
    this.name = 'EngineError'
    this.status = status
    this.code = code
  }
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (degrees) => (degrees * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRequestProfile(profile) {
  return {
    cellId: profile.cellId,
    districtId: profile.districtId,
    soil: profile.soil,
    water: profile.water,
    priorities: profile.priorities ?? [],
    history: profile.history ?? [],
    seasons: profile.seasons ?? 3,
  }
}

export function createApiEngine({
  baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  const root = baseUrl.replace(/\/+$/, '')

  async function post(path, body) {
    let response
    try {
      response = await fetchImpl(`${root}/gambia/engine/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (error) {
      throw new EngineError(
        error?.name === 'TimeoutError' ? 'The plan took too long to load.' : 'The FarmShift server could not be reached.',
        { code: error?.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK' },
      )
    }
    let data = null
    try {
      data = await response.json()
    } catch {
      // Fall through to the status check.
    }
    if (!response.ok) {
      throw new EngineError(data?.error?.message || `The FarmShift server returned ${response.status}.`, {
        status: response.status,
        code: data?.error?.code,
      })
    }
    return data
  }

  const districts = DISTRICTS.map(({ id, name, defaultSoil }) => ({ id, name, defaultSoil }))

  return {
    districts: () => districts,

    nearestCell(lat, lon) {
      let closest = null
      let closestDistance = Number.POSITIVE_INFINITY
      for (const district of DISTRICTS) {
        const distance = distanceKm(lat, lon, district.lat, district.lon)
        if (distance < closestDistance) {
          closest = district
          closestDistance = distance
        }
      }
      if (!closest || closestDistance > MAX_DISTANCE_KM) return null
      return { cellId: closest.id, districtId: closest.id }
    },

    plan: (profile, scenario, fixed = {}) => post('plan', {
      profile: toRequestProfile(profile),
      scenario,
      fixed,
    }),

    slotOptions: (profile, scenario, slot, fixed = {}) => post('slot-options', {
      profile: toRequestProfile(profile),
      scenario,
      slot,
      fixed,
    }),
  }
}
