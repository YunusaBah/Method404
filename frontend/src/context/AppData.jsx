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
import { fetchCatalogue } from '../api/crops'
import { translate } from '../i18n'
import { bundledCatalogue } from '../data/traits'
import {
  getSnapshot,
  setHorizon,
  setLanguage,
  setPlace,
  setPriority,
  setSoil,
  subscribe,
} from '../state/store'
import { AppDataContext } from './context'

export function AppDataProvider({ children }) {
  const { language, place, soil, priority, horizon } = useSyncExternalStore(subscribe, getSnapshot)

  const [status, setStatus] = useState(place ? 'loading' : 'idle')
  const [recommendation, setRecommendation] = useState(null)
  const [weather, setWeather] = useState(null)
  const [catalogue, setCatalogue] = useState(null)
  const [error, setError] = useState(null)
  const requestId = useRef(0)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  // The full 19-crop catalogue is reference data. Try the API for fresh
  // attribution; the bundled copy keeps the first visit completely offline.
  useEffect(() => {
    let cancelled = false
    void fetchCatalogue().then((data) => {
      if (!cancelled) setCatalogue(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

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
      horizon,
      setHorizon,
      status,
      error,
      recommendation,
      weather,
      catalogue: catalogue ?? bundledCatalogue,
    }),
    [
      language,
      place,
      choosePlace,
      soil,
      priority,
      horizon,
      status,
      error,
      recommendation,
      weather,
      catalogue,
    ],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}
