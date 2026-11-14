import { useT } from '../i18n'

export function OutcomeSquares({ outcomes }) {
  const { t } = useT()
  const good = outcomes.filter((outcome) => outcome === 'good').length
  const poor = outcomes.filter((outcome) => outcome === 'poor').length
  const failed = outcomes.filter((outcome) => outcome === 'failed').length

  return (
    <span
      aria-label={t('outcome.summary', { good, poor, failed })}
      className="squares"
      role="img"
    >
      {outcomes.map((outcome, index) => (
        <svg
          aria-hidden="true"
          className="square"
          height={16}
          key={index}
          viewBox="0 0 16 16"
          width={16}
        >
          <rect
            fill="none"
            height={14.5}
            stroke="currentColor"
            strokeWidth={1.5}
            width={14.5}
            x={0.75}
            y={0.75}
          />
          {outcome === 'good' ? (
            <rect fill="currentColor" height={14.5} width={14.5} x={0.75} y={0.75} />
          ) : null}
          {outcome === 'poor' ? (
            <rect fill="currentColor" height={14.5} width={7.25} x={0.75} y={0.75} />
          ) : null}
        </svg>
      ))}
    </span>
  )
}
