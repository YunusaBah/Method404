import { useEffect, useRef, useState } from 'react'
import { ArrowRight, LocateFixed, MapPin, Mic, Search } from 'lucide-react'
import { useAppData } from '../context/context'
import { nearestDistrict, suggestPlaces } from '../api/places'
import { DISTRICTS } from '../data/districts'
import { dictate, dictationSupported } from '../speech/listen'
import { languageById } from '../i18n'

const MIN_SUGGEST_LENGTH = 2
const CONFIDENT_SCORE = 80

export function LocationForm({ onPlace }) {
  const { language, t, status } = useAppData()

  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [error, setError] = useState(null)
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState('')
  const [locating, setLocating] = useState(false)
  const [resolving, setResolving] = useState(false)
  const session = useRef(null)

  useEffect(() => () => session.current?.stop(), [])

  // Type-ahead: the backend matches phonetically, so "kerew" already finds
  // Kerewan. Only the async callback touches state.
  useEffect(() => {
    const term = query.trim()
    if (term.length < MIN_SUGGEST_LENGTH) return undefined

    let cancelled = false
    const timer = setTimeout(() => {
      void suggestPlaces(term).then((matches) => {
        if (!cancelled) setSuggestions(matches.slice(0, 4))
      })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const visibleSuggestions = query.trim().length >= MIN_SUGGEST_LENGTH ? suggestions : []

  function choose(match) {
    setError(null)
    setSuggestions([])
    onPlace({ id: match.id, name: match.name, lat: match.lat, lon: match.lon })
  }

  async function submit(event) {
    event.preventDefault()
    const term = query.trim()
    if (!term) {
      setError('place')
      return
    }

    setResolving(true)
    const matches = await suggestPlaces(term)
    setResolving(false)

    if (matches.length === 0) {
      setError('place')
      return
    }
    if (matches[0].score >= CONFIDENT_SCORE) {
      choose(matches[0])
      return
    }

    setSuggestions(matches.slice(0, 4))
  }

  function useMyLocation() {
    const geolocation = navigator.geolocation
    if (!geolocation?.getCurrentPosition) {
      setError(window.isSecureContext === false ? 'geo_secure' : 'geo_unavailable')
      return
    }

    setLocating(true)
    setError(null)
    try {
      geolocation.getCurrentPosition(
        (position) => {
          setLocating(false)
          const lat = position?.coords?.latitude
          const lon = position?.coords?.longitude
          if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            lat < -90 ||
            lat > 90 ||
            lon < -180 ||
            lon > 180
          ) {
            setError('geo_unavailable')
            return
          }

          const { district } = nearestDistrict(lat, lon)
          setError(null)
          setSuggestions([])
          setQuery(district.name)
          onPlace({ id: district.id, name: district.name, lat, lon })
        },
        (positionError) => {
          setLocating(false)
          if (positionError.code === 1) setError('geo_denied')
          else if (positionError.code === 3) setError('geo_timeout')
          else setError('geo_unavailable')
        },
        { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
      )
    } catch {
      setLocating(false)
      setError(window.isSecureContext === false ? 'geo_secure' : 'geo_unavailable')
    }
  }

  function startDictation() {
    if (!dictationSupported || listening) return

    setListening(true)
    setError(null)
    setHeard('')

    const next = dictate({ lang: languageById(language).speech, onInterim: setHeard })
    session.current = next

    next.result
      .then(async (alternatives) => {
        setListening(false)
        setHeard('')

        if (alternatives.length === 0) {
          setError('speech')
          return
        }

        setQuery(alternatives[0])
        setResolving(true)
        const matches = await suggestPlaces(alternatives)
        setResolving(false)

        if (matches.length === 0) {
          setError('place')
          return
        }
        if (matches[0].exact) {
          choose(matches[0])
          return
        }
        setSuggestions(matches.slice(0, 4))
      })
      .catch(() => {
        setListening(false)
        setHeard('')
        setError('speech')
      })
  }

  const errorMessage = {
    place: t('error.place'),
    speech: t('error.speech'),
    geo_denied: t('error.geo_denied'),
    geo_secure: t('error.geo_secure'),
    geo_timeout: t('error.geo_timeout'),
    geo_unavailable: t('error.geo_unavailable'),
  }[error]

  const busy = resolving || status === 'loading'

  return (
    <form className="form-card" onSubmit={submit}>
      <label className="form-card__label" htmlFor="place">
        {t('form.label')}
      </label>

      <div className="field">
        <MapPin size={20} className="field__icon" aria-hidden="true" />
        <input
          id="place"
          className="field__input"
          type="text"
          name="place"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setError(null)
          }}
          placeholder={t('form.placeholder')}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={visibleSuggestions.length > 0}
          aria-controls="place-suggestions"
          aria-autocomplete="list"
        />
        <button
          type="button"
          className="mic"
          data-listening={listening}
          onClick={startDictation}
          disabled={!dictationSupported}
          aria-label={t('form.mic')}
          title={dictationSupported ? t('form.mic') : t('form.hint')}
        >
          <Mic size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {listening && (
        <p className="form-card__hint" role="status">
          {heard ? t('form.heard', { text: heard }) : t('form.listening')}
        </p>
      )}

      {visibleSuggestions.length > 0 && (
        <ul className="suggest" id="place-suggestions" role="listbox" aria-label={t('form.suggest')}>
          <li className="suggest__hint" aria-hidden="true">
            {t('form.suggest')}
          </li>
          {visibleSuggestions.map((match) => (
            <li key={match.id} role="option" aria-selected={false}>
              <button type="button" className="suggest__item" onClick={() => choose(match)}>
                <span className="suggest__name">{match.name}</span>
                <span className="suggest__region">{match.region}</span>
                <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="notice notice--error" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="button button--primary" disabled={busy}>
          <Search size={18} strokeWidth={2.2} aria-hidden="true" />
          {resolving ? t('form.searching') : t('form.submit')}
        </button>
        <button type="button" className="button button--ghost" onClick={useMyLocation} disabled={locating}>
          <LocateFixed size={18} strokeWidth={2.2} aria-hidden="true" />
          {locating ? t('form.locating') : t('form.locate')}
        </button>
      </div>

      <p className="form-card__hint">{t('form.hint')}</p>

      <div className="districts">
        {DISTRICTS.map((district) => (
          <button
            key={district.id}
            type="button"
            className="districts__button"
            onClick={() => onPlace({ id: district.id, name: district.name, lat: district.lat, lon: district.lon })}
          >
            {district.name}
          </button>
        ))}
      </div>
    </form>
  )
}
