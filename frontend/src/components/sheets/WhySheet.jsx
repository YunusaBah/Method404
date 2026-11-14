import { useT } from '../../i18n'
import { AudioButton } from '../AudioButton'
import { Sheet } from '../Sheet'

export function WhySheet({ onClose, onNumbers, open, reasons }) {
  const { t } = useT()
  const shown = reasons.slice(0, 3)

  return (
    <Sheet onClose={onClose} open={open} title={t('why.title')}>
      <ul className="reasons">
        {shown.map((reason) => (
          <li key={reason.code}>{t(`why.${reason.code}`)}</li>
        ))}
      </ul>
      <div className="why-actions">
        <AudioButton keys={['why.title', ...shown.map((reason) => `why.${reason.code}`)]} />
        <button className="button button--text" onClick={onNumbers} type="button">
          {t('why.numbers')}
        </button>
      </div>
    </Sheet>
  )
}
