import { Fragment } from 'react'
import { ArrowRight } from 'lucide-react'
import { useT } from '../i18n'
import { CropGlyph } from './CropGlyph'

export function OtherPlanRow({ onSelect, sequence }) {
  const { t } = useT()
  const worst = Math.min(
    ...sequence.slots.map((slot) => (
      slot.outcomes.filter((outcome) => outcome === 'good').length
    )),
  )

  return (
    <button className="other-plan" onClick={onSelect} type="button">
      <span className="other-plan__glyphs">
        {sequence.slots.map((slot, index) => (
          <Fragment key={slot.slot}>
            {index > 0 ? <ArrowRight size={16} strokeWidth={2} /> : null}
            <CropGlyph crop={slot.crop} size={32} />
          </Fragment>
        ))}
      </span>
      <span className="other-plan__caption">{t('plan.worst_good_in', { n: worst })}</span>
    </button>
  )
}
