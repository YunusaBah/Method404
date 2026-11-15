// The eight local government areas of The Gambia, with the coordinates the
// NASA POWER point request uses. Farmers pick one of these by name; the map
// pin is only a nicety.

export const DISTRICTS = [
  { id: 'banjul', name: 'Banjul', lat: 13.4549, lon: -16.579 },
  { id: 'kanifing', name: 'Kanifing', lat: 13.4464, lon: -16.6744 },
  { id: 'brikama', name: 'Brikama', lat: 13.2667, lon: -16.65 },
  { id: 'mansakonko', name: 'Mansakonko', lat: 13.4667, lon: -15.6833 },
  { id: 'kerewan', name: 'Kerewan', lat: 13.5, lon: -16.0833 },
  { id: 'kuntaur', name: 'Kuntaur', lat: 13.6667, lon: -14.8833 },
  { id: 'janjanbureh', name: 'Janjanbureh', lat: 13.5333, lon: -14.7667 },
  { id: 'basse', name: 'Basse Santa Su', lat: 13.3167, lon: -14.2167 },
]

/** Nearest district to a coordinate, used when the browser supplies a fix. */
export function nearestDistrict(lat, lon) {
  let best = DISTRICTS[0]
  let bestDistance = Number.POSITIVE_INFINITY

  for (const district of DISTRICTS) {
    const dLat = (district.lat - lat) * 111
    const dLon = (district.lon - lon) * 111 * Math.cos((lat * Math.PI) / 180)
    const distance = Math.hypot(dLat, dLon)
    if (distance < bestDistance) {
      best = district
      bestDistance = distance
    }
  }

  return { district: best, distanceKm: Math.round(bestDistance) }
}

/** Case-insensitive lookup that tolerates "basse santa su" and "Basse". */
export function findDistrict(query) {
  const needle = query.trim().toLowerCase()
  if (!needle) return null

  return (
    DISTRICTS.find((district) => district.name.toLowerCase() === needle) ??
    DISTRICTS.find((district) => district.id === needle) ??
    DISTRICTS.find((district) => district.name.toLowerCase().startsWith(needle)) ??
    null
  )
}
