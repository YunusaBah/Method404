import { createMockEngine } from './mock'

// The real agronomy engine is not part of this build. The mock is the only
// implementation, so it stays selected unless VITE_USE_MOCK is explicitly
// set to "false" for a future engine swap.
export const usingMock = import.meta.env.VITE_USE_MOCK !== 'false'

if (usingMock) {
  console.warn('[FarmShift] MOCK DATA: the agronomy engine is not connected.')
}

export const engine = createMockEngine()
