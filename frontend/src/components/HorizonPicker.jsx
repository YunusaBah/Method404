import { useAppData } from '../context/context'
import { HORIZONS } from '../lib/planning'

/**
 * Lets the farmer choose how many years ahead to prepare for. The same control
 * drives the planting calendar and the rotation length, so both screens agree
 * on the horizon.
 */
export function HorizonPicker() {
  const { horizon, setHorizon, t } = useAppData()

  return (
    <section className="horizon">
      <h2 className="horizon__title">{t('horizon.label')}</h2>

      <div className="chips" role="group" aria-label={t('horizon.label')}>
        {HORIZONS.map((years) => (
          <button
            key={years}
            type="button"
            className={`chip${horizon === years ? ' is-on' : ''}`}
            aria-pressed={horizon === years}
            onClick={() => setHorizon(years)}
          >
            {t(`horizon.${years}`)}
          </button>
        ))}
      </div>

      <p className="horizon__note">{t('horizon.note')}</p>
    </section>
  )
}
