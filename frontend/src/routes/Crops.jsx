import { useAppData } from '../context/context'
import { errorText } from '../lib/errors'
import { useSpeak } from '../audio/useSpeak'
import { rankCrops } from '../lib/rotation'
import { PlaceBar, PlaceGate } from '../components/PlaceGate'
import { FieldSetup } from '../components/FieldSetup'
import { CropCard } from '../components/CropCard'
import { Loading } from '../components/Loading'
import { Notice } from '../components/Notice'

export function Crops() {
  const { t, language, place, status, error, recommendation, soil, priority } = useAppData()
  const { ready, speak } = useSpeak(language)
  const ranked = recommendation ? rankCrops(recommendation.crops, { priority, soil }) : []

  return (
    <PlaceGate>
      <PlaceBar />

      <section className="section">
        <header className="section__head">
          <div>
            <p className="section__eyebrow">{t('results.eyebrow')}</p>
            <h1 className="section__title">{t('crops.title', { place: place?.name ?? '' })}</h1>
            <p className="section__sub">{t('crops.sub')}</p>
          </div>
        </header>

        {error && <Notice tone="error">{errorText(t, error)}</Notice>}
        {status === 'loading' && <Loading place={place} />}

        <FieldSetup />

        {status === 'ready' && recommendation && (
          <div className="crops-grid">
            {ranked.map((crop, index) => (
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
        )}
      </section>
    </PlaceGate>
  )
}
