import { useEffect, useRef, useState } from 'react'
import { engine } from '../engine'

const DEBOUNCE_MS = 150

export function usePlan(profile, scenario, pins) {
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(true)
  const requestId = useRef(0)

  useEffect(() => {
    const id = requestId.current + 1
    requestId.current = id
    let cancelled = false
    setBusy(true)

    const timer = window.setTimeout(() => {
      void engine.plan(profile, scenario, pins).then((next) => {
        if (cancelled || requestId.current !== id) return
        setResult(next)
        setBusy(false)
      })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [profile, scenario, pins])

  return { result, busy }
}
