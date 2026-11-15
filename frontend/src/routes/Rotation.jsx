import { useState } from 'react'
import { useAppData } from '../context/context'
import { errorText } from '../lib/errors'
import { scorePlan, suggestedPlans } from '../lib/rotation'
import { PlaceBar, PlaceGate } from '../components/PlaceGate'
import { FieldSetup } from '../components/FieldSetup'
import { PlanCard } from '../components/PlanCard'
import { Loading } from '../components/Loading'
import { Notice } from '../components/Notice'

const TITLES = ['rotation.planA', 'rotation.planB']
const WHY = ['rotation.why.1', 'rotation.why.2', 'rotation.why.3', 'rotation.why.4']

export function Rotation() {
  const { t, language, place, status, error, recommendation, soil, priority } = useAppData()
  const crops = recommendation?.crops ?? []
  const suggested = suggestedPlans(crops)
  const [edits, setEdits] = useState([null, null])

  const plans = suggested.map((base, index) => {
    const ids = edits[index]
    if (!ids) return base
    return ids.map((id) => crops.find((crop) => crop.id === id)).filter(Boolean)
  })

  const scores = plans.map((plan) => scorePlan(plan, { soil, priority }))
  const winner =
    scores[0] && scores[1] && scores[0].total !== scores[1].total
      ? scores[0].total > scores[1].total
        ? 0
        : 1
      : -1

  function edit(planIndex, mutate) {
    const current = plans[planIndex].map((crop) => crop.id)
    const next = mutate(current)
    setEdits((previous) => {
      const copy = [...previous]
      copy[planIndex] = next
      return copy
    })
  }

  const soilLabel = soil ? t(`setup.soil.${soil}`).toLowerCase() : null

  return (
    <PlaceGate>
      <PlaceBar />

      <section className="section">
        <header className="section__head">
          <div>
            <p className="section__eyebrow">{t('nav.rotation')}</p>
            <h1 className="section__title">{t('rotation.title')}</h1>
            <p className="section__sub">{t('rotation.sub')}</p>
          </div>
        </header>

        {error && <Notice tone="error">{errorText(t, error)}</Notice>}
        {status === 'loading' && <Loading place={place} />}

        <FieldSetup />

        {crops.length > 0 && (
          <>
            <h2 className="panel__title">{t('rotation.compare')}</h2>
            <p className="section__sub">{t('rotation.compareSub')}</p>

            <div className="plans">
              {plans.map((plan, index) => (
                <PlanCard
                  key={TITLES[index]}
                  title={t(TITLES[index])}
                  plan={plan}
                  crops={crops}
                  scored={scores[index]}
                  language={language}
                  soilLabel={soilLabel}
                  winner={winner === index}
                  onChange={(season, id) =>
                    edit(index, (ids) => {
                      ids[season] = id
                      return ids
                    })
                  }
                  onAdd={() =>
                    edit(index, (ids) => [...ids, crops[0]?.id ?? ids[0]])
                  }
                  onRemove={() => edit(index, (ids) => ids.slice(0, -1))}
                />
              ))}
            </div>

            <section className="why-rotation">
              <h2 className="panel__title">{t('rotation.why.title')}</h2>
              <ol className="why-grid">
                {WHY.map((key, index) => (
                  <li className="why-card" key={key}>
                    <span className="why-card__number" aria-hidden="true">
                      {index + 1}
                    </span>
                    <p>{t(key)}</p>
                  </li>
                ))}
              </ol>
              <p className="section__note">{t('rotation.disclaimer')}</p>
            </section>
          </>
        )}
      </section>
    </PlaceGate>
  )
}
