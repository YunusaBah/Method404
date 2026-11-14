import { useEffect, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { audioAvailable, speak } from '../audio/speak'
import { useT } from '../i18n'

export function AudioButton({ keys }) {
  const { language, t } = useT()
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    let active = true
    void audioAvailable(language).then((value) => {
      if (active) setAvailable(value)
    })
    return () => {
      active = false
    }
  }, [language])

  if (!available || keys.length === 0) return null

  return (
    <button
      aria-label={t('common.listen')}
      className="icon-button"
      onClick={() => void speak(keys, language)}
      type="button"
    >
      <Volume2 size={24} strokeWidth={2} />
    </button>
  )
}
