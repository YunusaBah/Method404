import { useT } from '../i18n'

export function RainStrip({ values }) {
  const { t } = useT()
  const max = Math.max(1, ...values)

  return (
    <span className="rain">
      <span className="rain__caption">{t('plan.rain_caption')}</span>
      <span aria-hidden="true" className="rain__bars">
        {values.map((value, index) => (
          <span className="rain__slot" key={index}>
            {value > 0 ? (
              <span
                className="rain__bar"
                style={{ height: `${Math.max(2, Math.round((value / max) * 40))}px` }}
              />
            ) : null}
          </span>
        ))}
      </span>
    </span>
  )
}
