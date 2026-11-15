import { ArrowRight, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppData } from '../context/context'
import { errorText } from '../lib/errors'
import { rankCrops } from '../lib/rotation'
import { useSpeak } from '../audio/useSpeak'
import { Hero } from '../components/Hero'
import { LocationForm } from '../components/LocationForm'
import { FieldSetup } from '../components/FieldSetup'
import { CropCard } from '../components/CropCard'
import { WeatherNow } from '../components/WeatherNow'
import { Loading } from '../components/Loading'
import { Notice } from '../components/Notice'

export function Home() {
  const {
    t, language, place, status, error, recommendation, weather, choosePlace, soil, priority,
  } = useAppData()
  const { ready, speak } = useSpeak(language)
  const ranked = recommendation ? rankCrops(recommendation.crops, { priority, soil }) : []

  return (
    <div className="home">
      <Hero />
      <LocationForm onPlace={choosePlace} />

      {error && <Notice tone="error">{errorText(t, error)}</Notice>}
      {status === 'loading' && <Loading place={place} />}

      {status === 'ready' && recommendation && place && (
        <>
          <WeatherNow weather={weather} />
          <FieldSetup />

          <section className="section">
            <header className="section__head">
              <div>
                <p className="section__eyebrow">{t('results.eyebrow')}</p>
                <h2 className="section__title">{t('results.title', { place: place.name })}</h2>
                <p className="section__sub">{t('results.sub')}</p>
              </div>
              <Link className="section__link" to="/crops">
                {t('results.all', { count: recommendation.crops.length })}
              </Link>
            </header>

            <div className="crops-grid">
              {ranked.slice(0, 3).map((crop, index) => (
                <CropCard
                  key={crop.id}
                  crop={crop}
                  rank={index + 1}
                  language={language}
                  isBest={index === 0}
                  onSpeak={ready ? speak : null}
                />
              ))}
            </div>

            <Link className="rotation-cta" to="/rotation">
              <RefreshCw size={22} strokeWidth={2} aria-hidden="true" />
              <span className="rotation-cta__text">
                <b>{t('rotation.cta')}</b>
                <small>{t('rotation.ctaSub')}</small>
              </span>
              <ArrowRight size={20} strokeWidth={2} aria-hidden="true" />
            </Link>
          </section>
        </>
      )}
    </div>
  )
}
