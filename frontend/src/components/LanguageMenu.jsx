import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { LANGUAGES, languageById } from '../i18n'

// Marks a language whose dictionary is still being written, so the menu does
// not pretend the switch changed anything.
const FALLBACK_CODE = 'EN'

export function LanguageMenu({ language, onSelect, label, chooseLabel, pendingLabel }) {
  const [open, setOpen] = useState(false)
  const container = useRef(null)
  const current = languageById(language)

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (event) => {
      if (container.current && !container.current.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="lang" ref={container}>
      <button
        type="button"
        className="lang__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        <Globe size={16} strokeWidth={2} aria-hidden="true" />
        <span className="lang__current">{current.native}</span>
        <ChevronDown size={14} strokeWidth={2.4} aria-hidden="true" />
      </button>

      {open && (
        <div className="lang__panel" role="listbox" aria-label={chooseLabel}>
          {LANGUAGES.map((option) => {
            const selected = option.id === language
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`lang__option${selected ? ' is-selected' : ''}`}
                onClick={() => {
                  onSelect(option.id)
                  setOpen(false)
                }}
              >
                <span className="lang__native">{option.native}</span>
                {!option.complete && (
                  <span className="lang__badge" title={pendingLabel}>
                    {FALLBACK_CODE}
                  </span>
                )}
                {selected && <Check size={16} strokeWidth={2.6} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
