import { get, set } from 'idb-keyval'

export async function loadValue(key) {
  try {
    return await get(key)
  } catch {
    return undefined
  }
}

export async function saveValue(key, value) {
  try {
    await set(key, value)
  } catch {
    // Storage can be blocked (private mode). The app keeps working for this session.
  }
}
