import { Droplets, Thermometer, Wind } from 'lucide-react'
import { useAppData } from '../context/context'
import { monthShort3 } from '../i18n'

function formatDate(value) {
  const date = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
}

export function WeatherNow({ weather }) {
  const { t } = useAppData()
  if (!weather?.current) return null

  const { current } = weather

  return (
    <section className="now" aria-label={t('weather.now')}>
      <div className="now__lead">
        <p className="now__eyebrow">{t('weather.now')}</p>
        <p className="now__temp">
          {Math.round(current.tMaxC)}
          <span className="now__unit">°C</span>
        </p>
        <p className="now__sub">{t('weather.reading', { date: formatDate(current.date) })}</p>
      </div>

      <dl className="now__grid">
        <div className="now__stat">
          <dt>
            <Thermometer size={14} strokeWidth={2} aria-hidden="true" />
            {t('weather.low')}
          </dt>
          <dd>{Math.round(current.tMinC)}°</dd>
        </div>
        <div className="now__stat">
          <dt>
            <Droplets size={14} strokeWidth={2} aria-hidden="true" />
            {t('weather.rain')}
          </dt>
          <dd>{current.rainMm} mm</dd>
        </div>
        <div className="now__stat">
          <dt>
            <Wind size={14} strokeWidth={2} aria-hidden="true" />
            {t('weather.humidity')}
          </dt>
          <dd>{current.humidityPct ?? '—'}%</dd>
        </div>
      </dl>
    </section>
  )
}

/** Twelve months of rain as horizontal bars, with the average high beside it. */
export function WeatherList({ monthly, language }) {
  const max = Math.max(1, ...monthly.map((month) => month.rainMm))

  return (
    <ul className="wx-list">
      {monthly.map((month) => (
        <li className="wx-row" key={month.month}>
          <span className="wx-row__month">{monthShort3(language, month.month)}</span>
          <span className="wx-row__track">
            <span
              className="wx-row__fill"
              data-empty={month.rainMm < 1}
              style={{ width: `${Math.max(2, (month.rainMm / max) * 100)}%` }}
            />
          </span>
          <span className="wx-row__mm">{month.rainMm} mm</span>
          <span className="wx-row__temp">{Math.round(month.tMaxC)}°</span>
        </li>
      ))}
    </ul>
  )
}

export function WeatherStats({ summary, language }) {
  const { t } = useAppData()

  return (
    <dl className="stats">
      <div className="stat">
        <dt>{t('weather.stat.rain')}</dt>
        <dd>{summary.annualRainMm.toLocaleString('en-GB')} mm</dd>
      </div>
      <div className="stat">
        <dt>{t('weather.stat.wettest')}</dt>
        <dd>{monthShort3(language, summary.wettestMonth)}</dd>
      </div>
      <div className="stat">
        <dt>{t('weather.stat.mean')}</dt>
        <dd>{summary.meanTMaxC} °C</dd>
      </div>
      <div className="stat">
        <dt>{t('weather.stat.dry')}</dt>
        <dd>{t('weather.stat.dryValue', { count: summary.dryMonths.length })}</dd>
      </div>
    </dl>
  )
}
