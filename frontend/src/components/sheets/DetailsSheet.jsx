import { usingMock } from '../../engine'
import { seasonLabel, useT } from '../../i18n'
import { Sheet } from '../Sheet'

export default function DetailsSheet({ onClose, open, result }) {
  const { language, t } = useT()

  return (
    <Sheet full onClose={onClose} open={open} title={t('details.title')}>
      <div className="details">
        {usingMock ? <p className="mock-banner">{t('details.mock')}</p> : null}

        {result.best.slots.map((slot) => {
          const rows = result.details.rows.filter((row) => row.slot === slot.slot)
          return (
            <section className="details__group" key={slot.slot}>
              <h3 className="details__title">
                {t(`crop.${slot.crop}`)}
                {' · '}
                {seasonLabel(language, slot.slot)}
              </h3>
              <p className="details__confidence">
                {t('details.confidence')}
                {': '}
                {t(`details.confidence.${slot.confidence}`)}
              </p>
              <dl className="details__rows">
                {rows.map((row) => (
                  <div className="details__row" key={`${row.slot}-${row.label}`}>
                    <dt>{row.label}</dt>
                    <dd className="details__value">{row.value}</dd>
                    <dd className="details__meta">
                      {t(`tag.${row.tag}`)}
                      {row.source ? ` · ${row.source}` : ''}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )
        })}
      </div>
    </Sheet>
  )
}
