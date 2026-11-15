import { monthName, monthShort, translate } from '../i18n'

export function MonthStrip({ months, bestMonth, language }) {
  const statusWord = (status) => translate(language, `status.${status}`)

  return (
    <div className="months">
      <p className="months__head">
        <span>{translate(language, 'months.title')}</span>
      </p>

      <div className="months__grid" role="list">
        {months.map(({ month, status }) => {
          const isBest = month === bestMonth
          return (
            <div
              key={month}
              role="listitem"
              className={`month month--${status}${isBest ? ' month--best' : ''}`}
              aria-label={translate(language, 'months.cell', {
                month: monthName(language, month),
                status: statusWord(status),
              })}
            >
              <span className="month__letter" aria-hidden="true">
                {monthShort(language, month)}
              </span>
              <span className="month__bar" aria-hidden="true" />
            </div>
          )
        })}
      </div>

      <div className="legend">
        <span>
          <i className="legend__swatch" aria-hidden="true" />
          {translate(language, 'months.good')}
        </span>
        <span>
          <i className="legend__swatch legend__swatch--possible" aria-hidden="true" />
          {translate(language, 'months.marginal')}
        </span>
        <span>
          <i className="legend__swatch legend__swatch--no" aria-hidden="true" />
          {translate(language, 'months.poor')}
        </span>
      </div>
    </div>
  )
}
