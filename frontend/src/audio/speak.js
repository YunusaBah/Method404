// Reads recommendations aloud. Uses the device voice: no audio files to
// download, and it works offline once the page is installed.

let voicesPromise = null
let voices = []

function loadVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve([])
  }
  if (voices.length > 0) return Promise.resolve(voices)
  if (voicesPromise) return voicesPromise

  voicesPromise = new Promise((resolve) => {
    const read = () => {
      voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) resolve(voices)
    }
    read()
    window.speechSynthesis.addEventListener('voiceschanged', read, { once: true })
    window.setTimeout(() => resolve(voices), 600)
  })

  return voicesPromise
}

/** True when the device has a voice for this language. */
export async function canSpeak(lang) {
  const available = await loadVoices()
  const base = lang.split('-')[0].toLowerCase()
  return available.some((voice) => voice.lang.toLowerCase().startsWith(base))
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

export function speakText(text, lang) {
  if (typeof window === 'undefined' || !text) return Promise.resolve()
  if (!('speechSynthesis' in window)) return Promise.resolve()

  return new Promise((resolve) => {
    stopSpeaking()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.95
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    window.speechSynthesis.speak(utterance)
  })
}
