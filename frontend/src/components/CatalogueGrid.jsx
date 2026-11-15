import { translate } from '../i18n'
import { cropThumb } from '../data/crops'

const GROUPS = [
  { key: 'annual', match: (crop) => crop.category === 'annual' },
  { key: 'orchard', match: (crop) => crop.category === 'orchard' },
]

export function CatalogueGrid({ crops, language }) {
  const t = (key, params) => translate(language, key, params)

  return (
    <section className="catalogue" aria-labelledby="catalogue-title">
      <header className="section__head">
        <div>
          <p className="section__eyebrow">{t('catalogue.eyebrow')}</p>
          <h2 className="section__title" id="catalogue-title">
            {t('catalogue.title')}
          </h2>
          <p className="section__sub">{t('catalogue.sub')}</p>
        </div>
      </header>

      {GROUPS.map((group) => {
        const entries = crops.filter(group.match)
        if (entries.length === 0) return null

        return (
          <div className="catalogue__group" key={group.key}>
            <h3 className="catalogue__heading">{t(`catalogue.${group.key}`)}</h3>
            <p className="catalogue__hint">{t(`catalogue.${group.key}Sub`)}</p>

            <ul className="catalogue__grid">
              {entries.map((crop) => (
                <li className="catalogue-card" key={crop.id}>
                  <img
                    className="catalogue-card__photo"
                    src={cropThumb(crop.id)}
                    alt={crop.name}
                    width="320"
                    height="240"
                    loading="lazy"
                  />
                  <div className="catalogue-card__body">
                    <h4 className="catalogue-card__name">{crop.name}</h4>
                    <p className="catalogue-card__sci">{crop.scientificName}</p>
                    <span className="catalogue-card__group">
                      {t(`catalogue.group.${crop.group}`)}
                    </span>
                    <span
                      className={`catalogue-card__badge${crop.scored ? ' is-ranked' : ''}`}
                    >
                      {crop.scored ? t('catalogue.ranked') : t('catalogue.notRanked')}
                    </span>
                    {crop.credit?.author && (
                      <p className="catalogue-card__credit">
                        {t('catalogue.credit', {
                          author: crop.credit.author,
                          licence: crop.credit.licence,
                        })}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      <p className="section__note">{t('catalogue.note')}</p>
    </section>
  )
}
