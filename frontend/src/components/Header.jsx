import { Leaf } from 'lucide-react'
import { useAppData } from '../context/context'
import { LanguageMenu } from './LanguageMenu'

export function Header() {
  const { language, setLanguage, t } = useAppData()

  return (
    <header className="topbar">
      <a className="brand" href="#/">
        <span className="brand__mark" aria-hidden="true">
          <Leaf size={20} strokeWidth={2.2} />
        </span>
        <span>
          <span className="brand__name">{t('brand.name')}</span>
          <span className="brand__tag">{t('brand.tagline')}</span>
        </span>
      </a>

      <LanguageMenu
        language={language}
        onSelect={setLanguage}
        label={t('lang.label')}
        chooseLabel={t('lang.choose')}
        pendingLabel={t('lang.pending')}
      />
    </header>
  )
}
