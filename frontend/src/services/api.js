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
