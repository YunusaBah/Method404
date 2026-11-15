import { useAppData } from '../context/context'

export function Hero() {
  const { t } = useAppData()

  return (
    <section className="hero">
      <img
        className="hero__media"
        src={`${import.meta.env.BASE_URL}hero.jpg`}
        alt=""
        width="1200"
        height="675"
        fetchPriority="high"
      />
      <div className="hero__veil" aria-hidden="true" />
      <div className="hero__content">
        <p className="eyebrow">{t('hero.source')}</p>
        <h1 className="hero__title">{t('hero.title')}</h1>
        <p className="hero__sub">{t('hero.sub')}</p>
      </div>
    </section>
  )
}
