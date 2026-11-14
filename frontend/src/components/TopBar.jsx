import { ArrowLeft } from 'lucide-react'
import { useT } from '../i18n'
import { AudioButton } from './AudioButton'

export function TopBar({ audioKeys, onBack, title }) {
  const { t } = useT()

  return (
    <header className="topbar">
      <div className="topbar__left">
        {onBack ? (
          <button
            aria-label={t('common.back')}
            className="icon-button"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft size={24} strokeWidth={2} />
          </button>
        ) : null}
        <p className="topbar__title">{title}</p>
      </div>
      <AudioButton keys={audioKeys} />
    </header>
  )
}
