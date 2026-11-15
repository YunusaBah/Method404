import { useAppData } from '../context/context'
import { errorText } from '../lib/errors'
import { DEFAULT_HORIZON, yearKey } from '../lib/planning'
import { PlaceBar, PlaceGate } from '../components/PlaceGate'
import { MonthCalendar } from '../components/MonthCalendar'
import { YearSummary } from '../components/YearSummary'
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
            <div className="years">
              {Array.from({ length: DEFAULT_HORIZON }, (_, offset) => (
                <section className="year" key={offset}>
                  <header className="year__head">
                    <h2 className="year__title">{t(yearKey(offset), { n: offset })}</h2>
                  </header>

                  {offset === 0 ? (
                    <MonthCalendar
                      crops={recommendation.crops}
                      climate={recommendation.climate}
                      language={language}
                    />
                  ) : (
                    <YearSummary
                      crops={recommendation.crops}
                      climate={recommendation.climate}
                      language={language}
                    />
                  )}
                </section>
              ))}
            </div>

            <p className="section__note">{t('plan.note')}</p>
            <p className="section__note">{t('plan.horizonNote')}</p>
          </>
        )}
      </section>
    </PlaceGate>
  )
}
