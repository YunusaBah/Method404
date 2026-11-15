const MESSAGES = {
  place: 'error.place',
  offline: 'error.offline',
  timeout: 'error.timeout',
  upstream_unavailable: 'error.upstream_unavailable',
  CLIMATE_UNAVAILABLE: 'error.upstream_unavailable',
  CLIMATE_EMPTY: 'error.upstream_unavailable',
  INVALID_LATITUDE: 'error.place',
  INVALID_LONGITUDE: 'error.place',
  geo_denied: 'error.geo_denied',
  speech: 'error.speech',
}

export function errorText(t, code) {
  return t(MESSAGES[code] ?? 'error.generic')
}
