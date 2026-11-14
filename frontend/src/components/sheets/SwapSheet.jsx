import { Lock } from 'lucide-react'
import { useT } from '../../i18n'
import { CropGlyph } from '../CropGlyph'
import { OutcomeSquares } from '../OutcomeSquares'
import { Sheet } from '../Sheet'

export function SwapSheet({
  current,
  onClear,
  onClose,
  onPick,
  open,
  options,
  pinned,
}) {
  const { t } = useT()

  return (
    <Sheet onClose={onClose} open={open} title={t('swap.title')}>
      <div className="swap">
        <div className="swap__current">
          <CropGlyph crop={current} size={40} />
          <span className="swap__name">{t(`crop.${current}`)}</span>
          {pinned ? (
            <span className="swap__pinned">
              <Lock size={18} strokeWidth={2} />
              {t('swap.you_chose')}
            </span>
          ) : null}
        </div>

        {options.length === 0 ? <p aria-busy="true">{t('common.loading')}</p> : null}

        <ul className="swap__options">
          {options.map((option) => {
            const good = option.outcomes.filter((outcome) => outcome === 'good').length
            return (
              <li key={option.crop}>
                <button
                  className="swap__option"
                  onClick={() => onPick(option.crop)}
                  type="button"
                >
                  <CropGlyph crop={option.crop} size={40} />
                  <span className="swap__body">
                    <span className="swap__name">{t(`crop.${option.crop}`)}</span>
                    <OutcomeSquares outcomes={option.outcomes} />
                    <span className="swap__caption">{t('plan.good_in', { n: good })}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {pinned ? (
          <button className="button button--text" onClick={onClear} type="button">
            {t('swap.let_app')}
          </button>
        ) : null}
      </div>
    </Sheet>
  )
}
