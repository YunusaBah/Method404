import { useSyncExternalStore } from 'react'
import { loadValue, saveValue } from '../persistence/db'

/** @typedef {'en' | 'mnk' | 'wo' | 'ff'} Lang */

const STORAGE_KEY = 'farmshift.state.v2'

const initialState = {
  hydrated: false,
  language: 'en',
  profile: null,
  scenario: { dTempC: 0, dRainPct: 0 },
  pins: {},
}

let state = initialState
const listeners = new Set()

export function getState() {
  return state
}

function subscribe(listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAppState() {
  return useSyncExternalStore(subscribe, getState, getState)
}

function emit() {
  for (const listener of listeners) listener()
}

function persist() {
  const snapshot = {
    language: state.language,
    profile: state.profile,
    scenario: state.scenario,
    pins: state.pins,
  }
  void saveValue(STORAGE_KEY, snapshot)
}

function update(patch) {
  state = { ...state, ...patch }
  emit()
  persist()
}

export async function hydrate() {
  const saved = await loadValue(STORAGE_KEY)
  if (saved && typeof saved === 'object' && saved.language) {
    state = {
      ...state,
      language: saved.language,
      profile: saved.profile ?? null,
      scenario: saved.scenario ?? initialState.scenario,
      pins: saved.pins ?? {},
      hydrated: true,
    }
  } else {
    state = { ...state, hydrated: true }
  }
  emit()
}

export function setLanguage(language) {
  update({ language })
}

export function setLocation(districtId, cellId, defaultSoil) {
  const profile = {
    cellId,
    districtId,
    soil: defaultSoil ?? 'unknown',
    soilIsDefault: defaultSoil !== null,
    water: 'rainfed',
    priorities: [],
    history: [],
    seasons: 3,
  }
  update({ profile, pins: {} })
}

export function setSoil(soil, soilIsDefault = false) {
  if (!state.profile) return
  update({ profile: { ...state.profile, soil, soilIsDefault }, pins: {} })
}

export function setWater(water) {
  if (!state.profile) return
  update({ profile: { ...state.profile, water }, pins: {} })
}

export function setPriorities(priorities) {
  if (!state.profile) return
  update({ profile: { ...state.profile, priorities } })
}

export function setScenario(scenario) {
  update({ scenario })
}

export function resetScenario() {
  update({ scenario: { dTempC: 0, dRainPct: 0 } })
}

export function setPin(slot, crop) {
  update({ pins: { ...state.pins, [slot]: crop } })
}

export function clearPin(slot) {
  const pins = { ...state.pins }
  delete pins[slot]
  update({ pins })
}
