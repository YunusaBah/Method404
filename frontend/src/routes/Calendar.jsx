import { useAppData } from '../context/context'
import { errorText } from '../lib/errors'
import { PlaceBar, PlaceGate } from '../components/PlaceGate'
import { MonthCalendar } from '../components/MonthCalendar'
import { Loading } from '../components/Loading'
import { Notice } from '../components/Notice'

export function Calendar() {
  const { t, language, place, status, error, recommendation } = useAppData()

  return (
    <PlaceGate>
      <PlaceBar />

      <section className="section">
        <header className="section__head">
          <div>
            <p className="section__eyebrow">{t('nav.plan')}</p>
            <h1 className="section__title">{t('plan.title')}</h1>
            <p className="section__sub">{t('plan.sub')}</p>
          </div>
        </header>

        {error && <Notice tone="error">{errorText(t, error)}</Notice>}
        {status === 'loading' && <Loading place={place} />}

        {status === 'ready' && recommendation && (
          <>
            <MonthCalendar
              crops={recommendation.crops}
              climate={recommendation.climate}
              language={language}
            />
            <p className="section__note">{t('plan.note')}</p>
          </>
        )}
      </section>
    </PlaceGate>
  )
}
