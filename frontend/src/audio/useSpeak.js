import { useCallback, useEffect, useState } from 'react'
import { canSpeak, speakText, stopSpeaking } from './speak'
import { languageById } from '../i18n'

export function useSpeak(language) {
  const [ready, setReady] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    let cancelled = false
    canSpeak(languageById(language).speech).then((ok) => {
      if (!cancelled) setReady(ok)
    })
    return () => {
      cancelled = true
      stopSpeaking()
    }
  }, [language])

  const speak = useCallback(
    async (text) => {
      if (!text) return
      setSpeaking(true)
      await speakText(text, languageById(language).speech)
      setSpeaking(false)
    },
    [language],
  )

  const stop = useCallback(() => {
    stopSpeaking()
    setSpeaking(false)
  }, [])

  return { ready, speaking, speak, stop }
}
