import { CalendarDays, Droplets, Sun, Thermometer, Volume2 } from 'lucide-react'
import { monthName, translate } from '../i18n'
import { cropPhoto } from '../data/crops'
import { MonthStrip } from './MonthStrip'

function Fact({ icon: Icon, label, value, note }) {
  return (
    <li className="fact">
      <span className="fact__icon" aria-hidden="true">
        <Icon size={16} strokeWidth={2} />
      </span>
      <span>
        <span className="fact__label">{label}</span>
        <span className="fact__value">
          {' '}
          <b>{value}</b>
          {note ? ` — ${note}` : ''}
        </span>
      </span>
    </li>
  )
}

export function CropCard({ crop, rank, language, isBest, onSpeak }) {
  const t = (key, params) => translate(language, key, params)
  const month = monthName(language, crop.bestMonth)
  const heatOk = crop.tMaxInBestMonthC <= crop.heatLimitC
  const dryOk = crop.drySpellDays === null || crop.drySpellDays <= 10

  const reasons = []
  if (crop.limiting === 'too_dry') {
    reasons.push(t('why.tooDry', { need: crop.waterNeedMm, rain: crop.rainInBestMonthMm }))
  } else if (crop.limiting === 'too_hot') {
    reasons.push(t('why.tooHot', { c: crop.tMaxInBestMonthC, limit: crop.heatLimitC }))
  } else if (crop.limiting === 'too_wet') {
    reasons.push(t('why.tooWet', { rain: crop.rainInBestMonthMm, max: crop.waterMaxMm ?? '—' }))
  } else {
    reasons.push(t('why.rain', { rain: crop.rainInBestMonthMm, need: crop.waterNeedMm }))
    reasons.push(t('why.heat', { c: crop.tMaxInBestMonthC, limit: crop.heatLimitC }))
    if (crop.drySpellDays !== null) reasons.push(t('why.dry', { days: crop.drySpellDays }))
  }

  const spoken = [crop.name, t('results.match', { score: crop.score }), ...reasons].join('. ')

  return (
    <article className={`crop${isBest ? ' crop--best' : ''}`}>
      <div className="crop__media">
        <img
          className="crop__photo"
          src={cropPhoto(crop.id)}
          alt={crop.name}
          width="640"
          height="512"
          loading={rank <= 2 ? 'eager' : 'lazy'}
          decoding="async"
        />
        <span className="crop__rank" aria-hidden="true">
          {rank}
        </span>
        <span className="crop__badge">
          {isBest ? t('results.best') : t('results.match', { score: crop.score })}
        </span>
      </div>

      <div className="crop__body">
        <div className="crop__head">
          <h3 className="crop__name">{crop.name}</h3>
          {onSpeak && (
            <button
              type="button"
              className="icon-button icon-button--compact"
              onClick={() => onSpeak(spoken)}
              aria-label={`${t('results.listen')} — ${crop.name}`}
            >
              <Volume2 size={17} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>

        <p className="crop__meta">
          <span>
            <CalendarDays size={14} strokeWidth={2} aria-hidden="true" />
            {t('crop.days', { days: crop.seasonDays })}
          </span>
          <span>
            <Droplets size={14} strokeWidth={2} aria-hidden="true" />
            {t('crop.rain', { mm: crop.waterNeedMm })}
          </span>
          {crop.fit === 'good' && <span className="crop__fit">{t('crop.fit.good')}</span>}
          {crop.fit === 'poor' && (
            <span className="crop__fit crop__fit--poor">{t('crop.fit.poor')}</span>
          )}
        </p>

        <MonthStrip months={crop.months} bestMonth={crop.bestMonth} language={language} />

        <p className="months__head" style={{ marginTop: 16 }}>
          {t('facts.title')}
        </p>
        <ul className="facts">
          <Fact
            icon={Droplets}
            label={t('facts.rain', { month })}
            value={t('facts.rainValue', { mm: crop.rainInBestMonthMm })}
            note={t('facts.rainOk')}
          />
          <Fact
            icon={Thermometer}
            label={t('facts.heat')}
            value={t('facts.heatValue', { c: crop.tMaxInBestMonthC })}
            note={
              heatOk
                ? t('facts.heatOk', { limit: crop.heatLimitC })
                : t('facts.heatHot', { limit: crop.heatLimitC })
            }
          />
          {crop.drySpellDays !== null && (
            <Fact
              icon={Sun}
              label={t('facts.dry')}
              value={t('facts.dryValue', { days: crop.drySpellDays })}
              note={dryOk ? t('facts.dryOk') : t('facts.dryRisk')}
            />
          )}
          <Fact
            icon={CalendarDays}
            label={t('facts.season', { month })}
            value={t('facts.seasonValue', { days: crop.seasonDays })}
          />
        </ul>

        <details className="why">
          <summary className="why__summary">{t('why.title')}</summary>
          <ul className="why__list">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </details>
      </div>
    </article>
  )
}
