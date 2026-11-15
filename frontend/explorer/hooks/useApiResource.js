import { useEffect, useState } from 'react'
import { isApiRequestCanceled } from '../services/api.js'

/**
 * Loads data with `load(signal)` whenever a value in `deps` changes, and
 * cancels the request if the inputs change or the component unmounts.
 * Set `enabled` to false to wait before loading.
 */
export function useApiResource(load, deps, { enabled = true } = {}) {
  const [attempt, setAttempt] = useState(0)
  const [resource, setResource] = useState({ status: enabled ? 'loading' : 'idle', key: null })
  const key = JSON.stringify([...deps, attempt])

  useEffect(() => {
    if (!enabled) return undefined
    const controller = new AbortController()

    load(controller.signal)
      .then((data) => setResource({ status: 'success', data, key }))
      .catch((error) => {
        if (!isApiRequestCanceled(error)) {
          setResource({ status: 'error', error: error.message, key })
        }
      })

    return () => controller.abort()
    // `load` is recreated on every render; `key` captures its real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  // While a newer request is in flight, report loading instead of stale data.
  const current = !enabled
    ? { status: 'idle' }
    : resource.key === key ? resource : { status: 'loading' }

  return { ...current, retry: () => setAttempt((value) => value + 1) }
}
