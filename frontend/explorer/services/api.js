import axios from 'axios'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api')
  .replace(/\/+$/, '')

export class ApiRequestError extends Error {
  constructor(message, { code, status, cause } = {}) {
    super(message, { cause })
    this.name = 'ApiRequestError'
    this.code = code
    this.status = status
  }
}

function normalizeApiError(error) {
  if (axios.isCancel(error)) {
    return error
  }

  const status = error.response?.status
  const responseMessage = error.response?.data?.error?.message
    || error.response?.data?.message
  let message = responseMessage

  if (!error.response) {
    message = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
      ? 'The backend request timed out. Please try again.'
      : 'Unable to connect to the FarmShift API. Check that the backend is running and try again.'
  } else if (typeof responseMessage !== 'string') {
    message = `The API request failed (${status}).`
  }

  return new ApiRequestError(message, {
    code: error.code,
    status,
    cause: error,
  })
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { Accept: 'application/json' },
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeApiError(error)),
)

export function isApiRequestCanceled(error) {
  return axios.isCancel(error)
}

export async function fetchBackendHealth({ signal } = {}) {
  const { data } = await apiClient.get('health', { signal })

  if (data?.success !== true || typeof data.message !== 'string') {
    throw new Error('The backend returned an unexpected health response.')
  }

  return data
}

// The ORNL MODIS/VIIRS service is slow and is queried one request at a time,
// so a first request can take several minutes. Results are then cached.
const SLOW_SOURCE_TIMEOUT_MS = 300000
const SOURCE_TIMEOUT_MS = 45000

export async function fetchGambiaRegion({ signal } = {}) {
  const { data } = await apiClient.get('gambia', { signal })
  return data
}

export async function fetchGambiaSources({ signal } = {}) {
  const { data } = await apiClient.get('gambia/sources', { signal })
  return data
}

export async function fetchGambiaSourceData(sourceId, params = {}, { signal, slow = false } = {}) {
  const { data } = await apiClient.get(`gambia/data/${encodeURIComponent(sourceId)}`, {
    params,
    signal,
    timeout: slow ? SLOW_SOURCE_TIMEOUT_MS : SOURCE_TIMEOUT_MS,
  })

  if (data?.success !== true || !data.data) {
    throw new Error('The backend returned an unexpected data response.')
  }

  return data
}

export async function fetchGambiaRecommendations(params = {}, { signal } = {}) {
  const { data } = await apiClient.get('gambia/recommendations', {
    params,
    signal,
    // Combines five sources, including NASA Earthdata point reads.
    timeout: 90000,
  })

  if (data?.success !== true || !Array.isArray(data.crops)) {
    throw new Error('The backend returned an unexpected recommendations response.')
  }

  return data
}

export async function fetchGambiaRotation(params = {}, { signal } = {}) {
  const { data } = await apiClient.get('gambia/rotation', { params, signal, timeout: 60000 })

  if (data?.success !== true || !Array.isArray(data.plan)) {
    throw new Error('The backend returned an unexpected rotation response.')
  }

  return data
}
