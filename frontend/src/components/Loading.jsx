import { useAppData } from '../context/context'

export function Loading({ place }) {
  const { t } = useAppData()

  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="loading__spinner" aria-hidden="true" />
      <span>
        <span className="loading__title">{t('loading.title', { place: place?.name ?? '' })}</span>
        <span className="loading__sub">{t('loading.sub')}</span>
      </span>
    </div>
  )
}
