const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .replace(/\/+$/, '')

export async function fetchBackendHealth({ signal } = {}) {
  const response = await fetch(`${API_BASE_URL}/api/health`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error('The backend returned an invalid response.')
  }

  if (!response.ok) {
    throw new Error(payload?.message || `Health check failed (${response.status}).`)
  }

  if (payload?.success !== true || typeof payload.message !== 'string') {
    throw new Error('The backend returned an unexpected health response.')
  }

  return payload
}
