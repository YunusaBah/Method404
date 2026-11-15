import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { fetchRecommendation, normalise } from '../api/recommend'
import { fetchWeather } from '../api/weather'
import { translate } from '../i18n'
import { getSnapshot, setLanguage, setPlace, setPriority, setSoil, subscribe } from '../state/store'
import { AppDataContext } from './context'

export function AppDataProvider({ children }) {
  const { language, place, soil, priority } = useSyncExternalStore(subscribe, getSnapshot)

  const [status, setStatus] = useState(place ? 'loading' : 'idle')
  const [recommendation, setRecommendation] = useState(null)
  const [weather, setWeather] = useState(null)
  const [error, setError] = useState(null)
  const requestId = useRef(0)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  // Both endpoints describe the same point, so they are fetched together. The
  // recommendation decides the page state; the weather degrades on its own.
  useEffect(() => {
    if (!place) return undefined

    const id = ++requestId.current

    void Promise.allSettled([fetchRecommendation(place), fetchWeather(place)]).then(
      ([recommendationResult, weatherResult]) => {
        if (requestId.current !== id) return

        if (recommendationResult.status === 'fulfilled') {
          setRecommendation(normalise(recommendationResult.value))
          setStatus('ready')
        } else {
          setError(recommendationResult.reason?.code ?? 'generic')
          setStatus('error')
        }

        setWeather(weatherResult.status === 'fulfilled' ? weatherResult.value : null)
      },
    )

    return () => {
      requestId.current += 1
    }
  }, [place])

  const choosePlace = useCallback((next) => {
    setStatus('loading')
    setError(null)
    setPlace(next)
  }, [])

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key, params) => translate(language, key, params),
      place,
      choosePlace,
      soil,
      setSoil,
      priority,
      setPriority,
      status,
      error,
      recommendation,
      weather,
    }),
    [language, place, choosePlace, soil, priority, status, error, recommendation, weather],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}
