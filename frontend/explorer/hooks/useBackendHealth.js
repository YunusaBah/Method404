import { useEffect, useState } from 'react'
import { fetchBackendHealth, isApiRequestCanceled } from '../services/api.js'

export function useBackendHealth() {
  const [attempt, setAttempt] = useState(0)
  const [health, setHealth] = useState({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    fetchBackendHealth({ signal: controller.signal })
      .then((data) => setHealth({ status: 'success', data }))
      .catch((error) => {
        if (!isApiRequestCanceled(error)) {
          setHealth({ status: 'error', error: error.message })
        }
      })

    return () => controller.abort()
  }, [attempt])

  return {
    ...health,
    retry: () => {
      setHealth({ status: 'loading' })
      setAttempt((previousAttempt) => previousAttempt + 1)
    },
  }
}
