import { LANGUAGES, useT } from '../i18n'
import { setLanguage } from '../state/store'

export function LanguageRow() {
  const { language, t } = useT()

  return (
    <nav aria-label={t('language.label')} className="languages">
      {LANGUAGES.map((entry) => (
        <button
          className={`languages__item${language === entry.id ? ' is-active' : ''}`}
          key={entry.id}
          lang={entry.htmlLang}
          onClick={() => setLanguage(entry.id)}
          type="button"
        >
          {t(`language.${entry.id}`)}
        </button>
      ))}
    </nav>
  )
}
