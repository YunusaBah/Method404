import { createApiEngine } from './api'
import { createMockEngine } from './mock'

// The real engine (NASA POWER and FAO GAEZ data through the FarmShift
// backend) is used by default. Set VITE_USE_MOCK=true to work on the UI
// without the backend; plans are then made-up and labelled MOCK DATA.
export const usingMock = import.meta.env.VITE_USE_MOCK === 'true'

if (usingMock) {
  console.warn('[FarmShift] MOCK DATA: the agronomy engine is not connected.')
}

export const engine = usingMock ? createMockEngine() : createApiEngine()
