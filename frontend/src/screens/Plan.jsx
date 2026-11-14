import { Fragment, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Droplets, Info, Layers, List } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { engine } from '../engine'
import { usePlan } from '../hooks/usePlan'
import { seasonLabel, useT } from '../i18n'
import { clearPin, resetScenario, setPin, useAppState } from '../state/store'
import { Chip } from '../components/Chip'
import { InsufficientNotice } from '../components/InsufficientNotice'
import { LanguageRow } from '../components/LanguageRow'
import { OtherPlanRow } from '../components/OtherPlanRow'
import { SeasonRow } from '../components/SeasonRow'
import { TopBar } from '../components/TopBar'
import { SwapSheet } from '../components/sheets/SwapSheet'
import { WhatIfSheet } from '../components/sheets/WhatIfSheet'
import { WhySheet } from '../components/sheets/WhySheet'

const DetailsSheet = lazy(() => import('../components/sheets/DetailsSheet'))

function buildAudioKeys(slots) {
  const keys = ['plan.best_intro']
  slots.forEach((slot, index) => {
    if (index === 1) keys.push('plan.then')
    keys.push(`crop.${slot.crop}`)
  })
  return keys
}

export function PlanScreen() {
  const { profile } = useAppState()
  if (!profile) return null
  return <PlanView profile={profile} />
}

function PlanView({ profile }) {
  const { language, pins, scenario } = useAppState()
  const { t } = useT()
  const navigate = useNavigate()
  const { result, busy, error, retry } = usePlan(profile, scenario, pins)

  const [picked, setPicked] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [swapSlot, setSwapSlot] = useState(null)
  const [swapState, setSwapState] = useState({ key: null, options: [] })
  const [changedSlots, setChangedSlots] = useState([])
  const pendingCompare = useRef(null)

  const ok = result && result.status === 'ok' ? result : null
  const insufficient = result && result.status === 'insufficient' ? result : null
  const displayed = ok
    ? (picked !== null ? ok.alternatives[picked] ?? ok.best : ok.best)
    : null

  const district = engine.districts().find((entry) => entry.id === profile.districtId)
  const hypothetical = scenario.dRainPct !== 0 || scenario.dTempC !== 0

  const closeSheet = useCallback(() => {
    if (window.history.state?.sheet) {
      window.history.back()
    } else {
      setSheet(null)
    }
  }, [])

  const pushSheet = useCallback((name) => {
    window.history.pushState({ ...window.history.state, sheet: name }, '')
    setChangedSlots([])
    setSheet(name)
  }, [])

  const replaceSheet = useCallback((name) => {
    window.history.replaceState({ ...window.history.state, sheet: name }, '')
    setSheet(name)
  }, [])

  useEffect(() => {
    const onPop = () => setSheet(null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Options are tied to the request that produced them, so stale options
  // from another slot or scenario are never shown.
  const swapKey = sheet === 'swap' && swapSlot !== null
    ? JSON.stringify([profile, scenario, pins, swapSlot])
    : null
  const swapOptions = swapState.key === swapKey ? swapState.options : []

  useEffect(() => {
    if (swapKey === null) return
    let active = true
    engine.slotOptions(profile, scenario, swapSlot, pins).then(
      (options) => {
        if (active) setSwapState({ key: swapKey, options })
      },
      () => {
        if (active) setSwapState({ key: swapKey, options: [] })
      },
    )
    return () => {
      active = false
    }
  }, [pins, profile, scenario, swapKey, swapSlot])

  useEffect(() => {
    const pending = pendingCompare.current
    if (!pending || !ok) return
    const changed = ok.best.slots
      .filter((slot, index) => (
        index !== pending.slot && slot.crop !== pending.previous[index]
      ))
      .map((slot) => slot.slot)
    setChangedSlots(changed)
    pendingCompare.current = null
  }, [ok])

  function openSwap(slot) {
    setPicked(null)
    setSwapSlot(slot)
    pushSheet('swap')
  }

  function handlePick(crop) {
    if (swapSlot === null || !displayed) return
    pendingCompare.current = {
      previous: displayed.slots.map((slot) => slot.crop),
      slot: swapSlot,
    }
    setPin(swapSlot, crop)
    closeSheet()
  }

  function handleClearPin() {
    if (swapSlot === null) return
    clearPin(swapSlot)
    setChangedSlots([])
    closeSheet()
  }

  const soilValue = profile.soil === 'unknown'
    ? t('chip.not_set')
    : t(`soil.${profile.soil}`)
  const waterValue = t(`water.${profile.water}`)
  const prioritiesValue = profile.priorities.length > 0
    ? profile.priorities.map((priority) => t(`priority.${priority}`)).join(', ')
    : t('chip.not_set')

  const currentSwapCrop = displayed && swapSlot !== null
    ? displayed.slots[swapSlot]?.crop
    : undefined

  return (
    <main className="screen">
      <TopBar
        audioKeys={displayed ? buildAudioKeys(displayed.slots) : []}
        title={district?.name ?? t('app.name')}
      />

      {hypothetical ? (
        <div className="scenario">
          <span>{t('plan.hypothetical')}</span>
          <button className="button button--text" onClick={resetScenario} type="button">
            {t('common.reset')}
          </button>
        </div>
      ) : null}

      <div className="chips">
        <Chip
          icon={<Layers size={18} strokeWidth={2} />}
          label={t('chip.soil')}
          onClick={() => navigate('/setup/soil')}
          value={soilValue}
        />
        <Chip
          icon={<Droplets size={18} strokeWidth={2} />}
          label={t('chip.water')}
          onClick={() => navigate('/setup/water')}
          value={waterValue}
        />
        <Chip
          icon={<List size={18} strokeWidth={2} />}
          label={t('chip.priorities')}
          onClick={() => navigate('/setup/priorities')}
          value={prioritiesValue}
        />
      </div>

      {profile.soilIsDefault ? (
        <button
          className="notice notice--plain"
          onClick={() => navigate('/setup/soil')}
          type="button"
        >
          {t('plan.default_soil')}
        </button>
      ) : null}

      {profile.water === 'irrigated' ? (
        <p className="notice">{t('water.notice')}</p>
      ) : null}

      <div className="plan-heading">
        <h1>{picked !== null ? t('plan.picked') : t('plan.title')}</h1>
        {ok ? (
          <button
            aria-label={t('why.title')}
            className="icon-button"
            onClick={() => pushSheet('why')}
            type="button"
          >
            <Info size={24} strokeWidth={2} />
          </button>
        ) : null}
      </div>

      {result === null && !error ? <p aria-busy="true">{t('common.loading')}</p> : null}

      {error ? (
        <div className="notice" role="alert">
          <p>{t('plan.error')}</p>
          <button className="button button--text" onClick={retry} type="button">
            {t('common.retry')}
          </button>
        </div>
      ) : null}

      {insufficient ? (
        <InsufficientNotice
          missing={insufficient.missing[0]}
          onFix={() => navigate(`/setup/${insufficient.missing[0]}`)}
        />
      ) : null}

      {ok && displayed ? (
        <>
          <div
            aria-busy={busy}
            className={`plan-stack${picked === null ? ' plan-stack--best' : ''}`}
          >
            {displayed.slots.map((slot, index) => (
              <Fragment key={`${slot.slot}-${slot.crop}`}>
                {index > 0 ? <span aria-hidden="true" className="connector" /> : null}
                <SeasonRow
                  changed={changedSlots.includes(slot.slot)}
                  label={seasonLabel(language, slot.slot)}
                  onChange={() => openSwap(slot.slot)}
                  season={slot}
                />
              </Fragment>
            ))}
          </div>

          {picked !== null ? (
            <button className="button button--text" onClick={() => setPicked(null)} type="button">
              {t('plan.back_best')}
            </button>
          ) : null}

          <button className="button button--outline" onClick={() => pushSheet('whatif')} type="button">
            {t('plan.what_if')}
          </button>

          {picked === null && ok.alternatives.length > 0 ? (
            <section className="others">
              <h2>{t('plan.other')}</h2>
              {ok.alternatives.slice(0, 4).map((alternative, index) => (
                <OtherPlanRow
                  key={alternative.slots.map((slot) => slot.crop).join('-')}
                  onSelect={() => setPicked(index)}
                  sequence={alternative}
                />
              ))}
            </section>
          ) : null}
        </>
      ) : null}

      <div className="plan-footer">
        <LanguageRow />
        <a className="button button--text" href="./data.html">
          {t('plan.explore_data')}
        </a>
      </div>

      {sheet === 'swap' && swapSlot !== null && currentSwapCrop ? (
        <SwapSheet
          current={currentSwapCrop}
          onClear={handleClearPin}
          onClose={closeSheet}
          onPick={handlePick}
          open
          options={swapOptions}
          pinned={pins[swapSlot] !== undefined}
        />
      ) : null}

      {sheet === 'why' && ok ? (
        <WhySheet
          onClose={closeSheet}
          onNumbers={() => replaceSheet('details')}
          open
          reasons={ok.reasons}
        />
      ) : null}

      {sheet === 'whatif' ? <WhatIfSheet onClose={closeSheet} open /> : null}

      {sheet === 'details' && ok ? (
        <Suspense fallback={null}>
          <DetailsSheet onClose={closeSheet} open result={ok} />
        </Suspense>
      ) : null}
    </main>
  )
}
