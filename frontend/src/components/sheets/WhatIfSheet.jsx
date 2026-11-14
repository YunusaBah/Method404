import { useT } from '../../i18n'
import { setScenario, useAppState } from '../../state/store'
import { Sheet } from '../Sheet'
import { Stepper } from '../Stepper'

export function WhatIfSheet({ onClose, open }) {
  const { t } = useT()
  const { scenario } = useAppState()

  return (
    <Sheet onClose={onClose} open={open} title={t('whatif.title')}>
      <div className="whatif">
        <p className="notice">{t('whatif.imagined')}</p>

        <Stepper
          format={(value) => `${value > 0 ? '+' : ''}${value}%`}
          label={t('whatif.rain')}
          max={20}
          maxLabel={t('whatif.more_rain')}
          min={-40}
          minLabel={t('whatif.less_rain')}
          onChange={(value) => setScenario({ ...scenario, dRainPct: value })}
          step={10}
          value={scenario.dRainPct}
        />

        <Stepper
          format={(value) => `+${value}°C`}
          label={t('whatif.heat')}
          max={3}
          maxLabel={t('whatif.hotter')}
          min={0}
          minLabel={t('whatif.zero')}
          onChange={(value) => setScenario({ ...scenario, dTempC: value })}
          step={1}
          value={scenario.dTempC}
        />
      </div>
    </Sheet>
  )
}
