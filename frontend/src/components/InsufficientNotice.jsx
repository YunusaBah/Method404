import { useT } from '../i18n'

export function InsufficientNotice({ missing, onFix }) {
  const { t } = useT()

  return (
    <div className="insufficient">
      <p>{t(`insufficient.${missing}`)}</p>
      <button className="button button--primary" onClick={onFix} type="button">
        {t(`insufficient.action.${missing}`)}
      </button>
    </div>
  )
}
