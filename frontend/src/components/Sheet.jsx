import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useT } from '../i18n'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

export function Sheet({ children, full = false, onClose, open, title }) {
  const { t } = useT()
  const panelRef = useRef(null)
  const restoreRef = useRef(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement
    const panel = panelRef.current
    const focusables = () => (
      panel ? Array.from(panel.querySelectorAll(FOCUSABLE)) : []
    )
    focusables()[0]?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      restoreRef.current?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeRef.current()
      }}
    >
      <div
        aria-label={title}
        aria-modal="true"
        className={`sheet${full ? ' sheet--full' : ''}`}
        ref={panelRef}
        role="dialog"
      >
        <div className="sheet__header">
          <h2 className="sheet__title">{title}</h2>
          <button
            aria-label={t('common.close')}
            className="sheet__close"
            onClick={() => closeRef.current()}
            type="button"
          >
            <X size={24} strokeWidth={2} />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
