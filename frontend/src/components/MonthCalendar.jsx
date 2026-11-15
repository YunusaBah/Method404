import { useAppData } from '../context/context'
import { monthName } from '../i18n'
import { cropPhoto } from '../data/crops'
import { groupMonths } from '../lib/calendar'

function label(language, row) {
  if (row.from === row.to) return monthName(language, row.from)
  return `${monthName(language, row.from)} – ${monthName(language, row.to)}`
}

export function MonthCalendar({ crops, climate, language }) {
  const { t } = useAppData()
  const currentMonth = new Date().getMonth() + 1
  const rows = groupMonths(crops, climate)

  return (
    <ol className="calendar">
      {rows.map((row) => {
        const isNow = currentMonth >= row.from && currentMonth <= row.to
        const span = row.to - row.from + 1
        const rain = Math.round(row.rain)

        return (
          <li
            key={`${row.type}-${row.from}`}
            className={`cal${row.type === 'dry' ? ' cal--dry' : ''}${isNow ? ' is-now' : ''}`}
          >
            <div className="cal__head">
              <span className="cal__month">{label(language, row)}</span>
              {isNow && <span className="cal__now">{t('plan.now')}</span>}
              <span className="cal__rain">
                {span > 1 ? t('plan.span', { rain, count: span }) : `${rain} mm`}
              </span>
            </div>

            {row.type === 'sow' ? (
              <ul className="cal__crops">
                {row.crops.map((crop, index) => (
                  <li key={crop.id} className="cal-crop">
                    <img
                      className="cal-crop__photo"
                      src={cropPhoto(crop.id)}
                      alt=""
                      width="48"
                      height="48"
                      loading="lazy"
                    />
                    <span className="cal-crop__name">{crop.name}</span>
                    {index === 0 && <span className="cal-crop__best">{t('plan.best')}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cal__none">{t('plan.none')}</p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
