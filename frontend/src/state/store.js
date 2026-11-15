// Small external store shared by the whole page. What survives a reload: the
// chosen language, the last field, the ground the farmer described, what they
// care about most, and the answer we cached for that field.

import { loadValue, saveValue } from '../persistence/db'

const STORAGE_KEY = 'farmshift.v3'

const listeners = new Set()

let state = {
  hydrated: false,
  language: 'en',
  place: null,
  soil: null,
  priority: 'yield',
}

function emit() {
  for (const listener of listeners) listener()
}

function persist() {
  void saveValue(STORAGE_KEY, {
    language: state.language,
    place: state.place,
    soil: state.soil,
    priority: state.priority,
  })
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot() {
  return state
}

export async function hydrate() {
  const saved = await loadValue(STORAGE_KEY)
  state = {
    hydrated: true,
    language: saved?.language ?? 'en',
    place: saved?.place ?? null,
    soil: saved?.soil ?? null,
    priority: saved?.priority ?? 'yield',
  }
  emit()
  return state
}

export function setLanguage(language) {
  if (language === state.language) return
  state = { ...state, language }
  emit()
  persist()
}

export function setPlace(place) {
  state = { ...state, place }
  emit()
  persist()
}

export function setSoil(soil) {
  if (soil === state.soil) return
  state = { ...state, soil }
  emit()
  persist()
}

export function setPriority(priority) {
  if (priority === state.priority) return
  state = { ...state, priority }
  emit()
  persist()
}

export function clearPlace() {
  state = { ...state, place: null }
  emit()
  persist()
}
