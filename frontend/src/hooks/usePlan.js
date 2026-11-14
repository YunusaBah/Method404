import { useEffect, useRef, useState } from 'react'
import { engine } from '../engine'

const DEBOUNCE_MS = 150

/**
 * Asks the engine for a plan whenever the farm, scenario or pins change.
 * `result` keeps the last plan while a new one loads (`busy`). When the
 * engine fails, `error` is set and `retry()` asks again.
 */
export function usePlan(profile, scenario, pins) {
  const [state, setState] = useState({ result: null, error: null, key: null })
  const [attempt, setAttempt] = useState(0)
  const requestId = useRef(0)
  const key = JSON.stringify([profile, scenario, pins, attempt])

  useEffect(() => {
    const id = requestId.current + 1
    requestId.current = id
    let cancelled = false

    const timer = window.setTimeout(() => {
      engine.plan(profile, scenario, pins).then(
        (next) => {
          if (cancelled || requestId.current !== id) return
          setState({ result: next, error: null, key })
        },
        (error) => {
          if (cancelled || requestId.current !== id) return
          setState((previous) => ({ result: previous.result, error, key }))
        },
      )
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [key, profile, scenario, pins])

  const busy = state.key !== key
  return {
    result: state.result,
    error: busy ? null : state.error,
    busy,
    retry: () => setAttempt((value) => value + 1),
  }
}
