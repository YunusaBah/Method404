// GET /api/crops is the runtime view of the same catalogue that is bundled into
// the app. It adds attribution metadata and lets other clients share the list.
// When the API is unreachable the bundled copy is used, so a farmer with no
// signal still sees every crop and every photograph.

import { loadValue, saveValue } from '../persistence/db'
import { bundledCatalogue } from '../data/traits'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')
const CACHE_KEY = 'farmshift.catalogue.v1'
const TIMEOUT_MS = 12_000

export async function fetchCatalogue() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${BASE_URL}/crops`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`catalogue: ${response.status}`)
    const data = await response.json()
    if (!Array.isArray(data.crops) || data.crops.length === 0) {
      throw new Error('catalogue: empty')
    }
    void saveValue(CACHE_KEY, data)
    return data
  } catch {
    const cached = await loadValue(CACHE_KEY)
    if (cached?.crops?.length) return cached
    return {
      region: bundledCatalogue.region,
      version: bundledCatalogue.version,
      sources: bundledCatalogue.sources,
      crops: bundledCatalogue.crops.map((crop) => ({ ...crop, credit: null })),
    }
  } finally {
    clearTimeout(timer)
  }
}
