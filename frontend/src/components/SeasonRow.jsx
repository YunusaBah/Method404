import { Lock } from 'lucide-react'
import { useT } from '../i18n'
import { CropGlyph } from './CropGlyph'
import { OutcomeSquares } from './OutcomeSquares'
import { RainStrip } from './RainStrip'

export function SeasonRow({ changed, label, onChange, season }) {
  const { t } = useT()
  const good = season.outcomes.filter((outcome) => outcome === 'good').length

  return (
    <button
      aria-haspopup="dialog"
      className={`season${changed ? ' is-changed' : ''}`}
      onClick={onChange}
      type="button"
    >
      <span className="season__glyph">
        <CropGlyph crop={season.crop} size={48} />
      </span>
      <span className="season__body">
        <span className="season__top">
          <span className="season__crop">{t(`crop.${season.crop}`)}</span>
          <span className="season__when">{label}</span>
        </span>
        <OutcomeSquares outcomes={season.outcomes} />
        <span className="season__caption">{t('plan.good_in', { n: good })}</span>
        <RainStrip values={season.rainWeekly} />
        {season.confidence === 'low' ? (
          <span className="season__flag">{t('plan.low_confidence')}</span>
        ) : null}
        {season.pinned ? (
          <span className="season__flag">
            <Lock size={18} strokeWidth={2} />
            {t('swap.you_chose')}
          </span>
        ) : null}
        {changed ? (
          <span className="season__flag season__flag--changed">{t('plan.changed')}</span>
        ) : null}
      </span>
    </button>
  )
}
