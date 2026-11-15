import { Check } from 'lucide-react'
import { useAppData } from '../context/context'
import { PRIORITIES, SOILS } from '../data/traits'

/** The two things the challenge asks for that weather alone cannot answer. */
export function FieldSetup() {
  const { soil, setSoil, priority, setPriority, t } = useAppData()
  const touched = Boolean(soil) || priority !== 'yield'

  return (
    <section className="setup" aria-labelledby="setup-title">
      <div className="setup__head">
        <div>
          <h2 className="setup__title" id="setup-title">
            {t('setup.title')}
          </h2>
          <p className="setup__sub">{t('setup.sub')}</p>
        </div>
        {touched && (
          <button
            type="button"
            className="setup__reset"
            onClick={() => {
              setSoil(null)
              setPriority('yield')
            }}
          >
            {t('setup.reset')}
          </button>
        )}
      </div>

      <div className="setup__group" role="group" aria-label={t('setup.soil')}>
        <p className="setup__label">{t('setup.soil')}</p>
        <div className="choices">
          {SOILS.map((option) => (
            <button
              key={option}
              type="button"
              className={`choice${soil === option ? ' is-on' : ''}`}
              aria-pressed={soil === option}
              onClick={() => setSoil(soil === option ? null : option)}
            >
              <span className={`choice__swatch choice__swatch--${option}`} aria-hidden="true" />
              <span className="choice__text">
                <span className="choice__name">{t(`setup.soil.${option}`)}</span>
                <span className="choice__hint">{t(`setup.soil.${option}Hint`)}</span>
              </span>
              {soil === option && <Check size={16} strokeWidth={2.4} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>

      <div className="setup__group" role="group" aria-label={t('setup.priority')}>
        <p className="setup__label">{t('setup.priority')}</p>
        <div className="chips">
          {PRIORITIES.map((option) => (
            <button
              key={option}
              type="button"
              className={`chip${priority === option ? ' is-on' : ''}`}
              aria-pressed={priority === option}
              onClick={() => setPriority(option)}
            >
              {t(`setup.priority.${option}`)}
            </button>
          ))}
        </div>
      </div>

      <p className="setup__note">
        {t('setup.summary', {
          soil: t(`setup.soil.${soil ?? 'any'}`).toLowerCase(),
          priority: t(`setup.priority.${priority}`).toLowerCase(),
        })}{' '}
        {t('setup.note')}
      </p>
    </section>
  )
}
