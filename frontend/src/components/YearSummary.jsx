import { useAppData } from '../context/context'
import { monthName } from '../i18n'
import { cropThumb } from '../data/crops'
import { sowingWindows } from '../lib/planning'

function rangeLabel(language, from, to) {
  if (from === to) return monthName(language, from)
  return `${monthName(language, from)} – ${monthName(language, to)}`
}

/**
 * A compact planting plan for a year beyond the current one. The detailed month
 * calendar is shown for this year only; later years repeat the same typical
 * pattern, so they get the windows and their top crops instead of a copy.
 */
export function YearSummary({ crops, climate, language }) {
  const { t } = useAppData()
  const windows = sowingWindows(crops, climate)

  if (windows.length === 0) {
    return <p className="year__none">{t('plan.none')}</p>
  }

  return (
    <ul className="windows">
      {windows.map((window) => (
        <li className="window" key={window.from}>
          <div className="window__head">
            <span className="window__months">{rangeLabel(language, window.from, window.to)}</span>
            <span className="window__rain">
              {t('plan.windowRain', { mm: Math.round(window.rain) })}
            </span>
          </div>

          <ul className="window__crops">
            {window.crops.map((crop) => (
              <li className="window-crop" key={crop.id}>
                <img
                  className="window-crop__photo"
                  src={cropThumb(crop.id)}
                  alt=""
                  width="26"
                  height="26"
                  loading="lazy"
                />
                <span className="window-crop__name">{crop.name}</span>
              </li>
            ))}
            {window.extra > 0 && (
              <li className="window__more">{t('plan.more', { count: window.extra })}</li>
            )}
          </ul>
        </li>
      ))}
    </ul>
  )
}
