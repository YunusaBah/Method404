import { useAppData } from '../context/context'
import { errorText } from '../lib/errors'
import { monthShort3 } from '../i18n'
import { PlaceBar, PlaceGate } from '../components/PlaceGate'
import { WeatherList, WeatherNow, WeatherStats } from '../components/WeatherNow'
import { Loading } from '../components/Loading'
import { Notice } from '../components/Notice'

export function Weather() {
  const { t, language, place, status, error, weather } = useAppData()

  const summary = weather?.summary
  const wet = summary?.wetMonths ?? []
  const season =
    summary && wet.length > 0
      ? t('weather.wetSeason', {
          from: monthShort3(language, wet[0]),
          to: monthShort3(language, wet[wet.length - 1]),
          peak: monthShort3(language, summary.wettestMonth),
        })
      : null

  return (
    <PlaceGate>
      <PlaceBar />

      <section className="section">
        <header className="section__head">
          <div>
            <p className="section__eyebrow">{t('nav.weather')}</p>
            <h1 className="section__title">{t('weather.title', { place: place?.name ?? '' })}</h1>
            <p className="section__sub">{t('weather.sub')}</p>
          </div>
        </header>

        {error && <Notice tone="error">{errorText(t, error)}</Notice>}
        {status === 'loading' && <Loading place={place} />}

        {weather && (
          <>
            <WeatherNow weather={weather} />
            {summary && <WeatherStats summary={summary} language={language} />}

            <div className="panel">
              <h2 className="panel__title">{t('weather.chart')}</h2>
              {weather.monthly && <WeatherList monthly={weather.monthly} language={language} />}
            </div>

            {season && (
              <div className="reading">
                <p className="reading__line">{season}</p>
                {summary.dryMonths.length > 0 && (
                  <p className="reading__line">
                    {t('weather.drySeason', {
                      months: summary.dryMonths.map((month) => monthShort3(language, month)).join(', '),
                    })}
                  </p>
                )}
                <p className="reading__line">{t('weather.shift')}</p>
              </div>
            )}
          </>
        )}
      </section>
    </PlaceGate>
  )
}
