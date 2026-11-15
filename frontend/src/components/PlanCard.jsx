import { Minus, Plus } from 'lucide-react'
import { translate } from '../i18n'
import { cropPhoto } from '../data/crops'
import { planNotes } from '../lib/rotation'

const BARS = [
  { key: 'soil', label: 'rotation.score.soil' },
  { key: 'water', label: 'rotation.score.water' },
  { key: 'variety', label: 'rotation.score.variety' },
  { key: 'speed', label: 'rotation.score.speed' },
]

export function PlanCard({
  title,
  plan,
  crops,
  scored,
  language,
  soilLabel,
  winner,
  onChange,
  onAdd,
  onRemove,
}) {
  const t = (key, params) => translate(language, key, params)
  const notes = planNotes(scored, soilLabel)

  return (
    <article className={`plan${winner ? ' plan--winner' : ''}`}>
      <header className="plan__head">
        <h3 className="plan__title">{title}</h3>
        {winner && <span className="plan__badge">{t('rotation.winner')}</span>}
      </header>

      <ol className="seasons">
        {plan.map((crop, index) => (
          <li className="season" key={`${index}-${crop.id}`}>
            <span className="season__label">{t('rotation.season', { n: index + 1 })}</span>
            <img
              className="season__photo"
              src={cropPhoto(crop.id)}
              alt=""
              width="40"
              height="40"
              loading="eager"
            />
            <select
              className="season__select"
              value={crop.id}
              onChange={(event) => onChange(index, event.target.value)}
              aria-label={t('rotation.season', { n: index + 1 })}
            >
              {crops.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ol>

      <div className="plan__actions">
        <button type="button" className="plan__action" onClick={onAdd} disabled={plan.length >= 4}>
          <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
          {t('rotation.add')}
        </button>
        <button type="button" className="plan__action" onClick={onRemove} disabled={plan.length <= 2}>
          <Minus size={14} strokeWidth={2.2} aria-hidden="true" />
          {t('rotation.remove')}
        </button>
      </div>

      {scored && (
        <>
          <ul className="bars">
            {BARS.map((bar) => (
              <li className="bar" key={bar.key}>
                <span className="bar__label">{t(bar.label)}</span>
                <span className="bar__track">
                  <span className="bar__fill" style={{ width: `${scored[bar.key]}%` }} />
                </span>
                <span className="bar__value">{scored[bar.key]}</span>
              </li>
            ))}
          </ul>

          <p className="plan__need">
            {t('rotation.need', { mm: scored.waterNeedMm, days: scored.seasonDays })}
          </p>

          <p className="plan__total">
            {t('rotation.total')} <b>{scored.total}</b>
            <span className="plan__totalMax"> / 100</span>
          </p>

          <p className="plan__notesTitle">{t('rotation.notes')}</p>
          <ul className="plan__notes">
            {notes.map((note) => (
              <li key={note.key}>{t(note.key, note.params)}</li>
            ))}
          </ul>
        </>
      )}
    </article>
  )
}
