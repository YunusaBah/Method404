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
  return axios.isCancel(error) || error?.name === 'AbortError'
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

export async function fetchGambiaCropCatalog({ signal } = {}) {
  const { data } = await apiClient.get('gambia/crops', { signal })

  if (data?.success !== true || !Array.isArray(data.crops) || !Array.isArray(data.featuredCrops)) {
    throw new Error('The backend returned an unexpected crop list.')
  }

  return data
}

export async function fetchGambiaCropPrediction(cropId, params = {}, { signal } = {}) {
  const { data } = await apiClient.get(
    `gambia/crops/${encodeURIComponent(cropId)}/prediction`,
    { params, signal },
  )

  if (data?.success !== true || typeof data.available !== 'boolean' || !data.climate) {
    throw new Error('The backend returned an unexpected crop prediction response.')
  }

  return data
}

const cropPhotoRequests = new Map()
const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php'

export async function fetchGambiaCropPhoto(crop, { signal } = {}) {
  const cached = cropPhotoRequests.get(crop)
  if (cached) return cached

  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `"${crop}" plant`,
    gsrnamespace: '6',
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '960',
    format: 'json',
    origin: '*',
  })
  const request = fetch(`${COMMONS_API_URL}?${params}`, { signal })
    .then(async (response) => {
      if (!response.ok) throw new Error('Crop photos are temporarily unavailable.')
      const payload = await response.json()
      const pages = Object.values(payload?.query?.pages ?? {})
      const cropTerms = crop.toLowerCase().split(/\s+/)
      const plainText = (value) => (value ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim()
      const photo = pages
        .map((page) => ({ page, info: page.imageinfo?.[0] }))
        .filter(({ page, info }) => {
          if (!/\.(jpe?g|png|webp)$/i.test(page.title) || !info?.thumburl || !info.descriptionurl
            || !info.extmetadata?.LicenseShortName?.value) return false
          const imageHost = new URL(info.thumburl).hostname
          const sourceHost = new URL(info.descriptionurl).hostname
          const license = info.extmetadata.LicenseShortName.value
          return (imageHost === 'upload.wikimedia.org' || imageHost === 'thumb.wikimedia.org')
            && sourceHost === 'commons.wikimedia.org'
            && (/^(CC BY|CC0|Public domain|No restrictions)/i.test(license))
        })
        .map(({ page, info }) => {
          const text = `${page.title} ${plainText(info.extmetadata.ObjectName?.value)}`.toLowerCase()
          return {
            info,
            score: cropTerms.filter((term) => text.includes(term)).length,
          }
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)[0]?.info

      if (!photo) throw new Error(`No reusable photo was found for ${crop}.`)

      const artist = plainText(photo.extmetadata.Artist?.value) || 'Wikimedia Commons contributor'
      const license = photo.extmetadata.LicenseShortName.value
      return {
        image: photo.thumburl,
        page: photo.descriptionurl,
        artist,
        license,
        licenseUrl: photo.extmetadata.LicenseUrl?.value || photo.descriptionurl,
        alt: `${crop} plant photo`,
      }
    })
    .catch((error) => {
      cropPhotoRequests.delete(crop)
      throw error
    })

  cropPhotoRequests.set(crop, request)
  return request
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
