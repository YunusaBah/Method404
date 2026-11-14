import { translate } from '../i18n'

const clipCache = new Map()
let cachedVoices = []
let voicesPromise = null

function loadVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve([])
  }
  if (cachedVoices.length > 0) return Promise.resolve(cachedVoices)
  if (voicesPromise) return voicesPromise

  voicesPromise = new Promise((resolve) => {
    const read = () => {
      cachedVoices = window.speechSynthesis.getVoices()
      if (cachedVoices.length > 0) resolve(cachedVoices)
    }
    read()
    window.speechSynthesis.addEventListener('voiceschanged', read, { once: true })
    window.setTimeout(() => resolve(cachedVoices), 600)
  })

  return voicesPromise
}

export async function audioAvailable(lang) {
  const voices = await loadVoices()
  return voices.some((voice) => voice.lang.toLowerCase().startsWith(lang))
}

async function clipExists(url) {
  const cached = clipCache.get(url)
  if (cached !== undefined) return cached
  try {
    const response = await fetch(url, { method: 'HEAD' })
    clipCache.set(url, response.ok)
    return response.ok
  } catch {
    clipCache.set(url, false)
    return false
  }
}

function playClip(url) {
  return new Promise((resolve) => {
    const audio = new Audio(url)
    audio.onended = () => resolve(true)
    audio.onerror = () => resolve(false)
    void audio.play().catch(() => resolve(false))
  })
}

function speakText(text, lang) {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    window.speechSynthesis.speak(utterance)
  })
}

export async function speak(keys, lang) {
  if (typeof window === 'undefined' || keys.length === 0) return
  const canSpeak = await audioAvailable(lang)
  if (!canSpeak) return

  window.speechSynthesis.cancel()

  for (const key of keys) {
    const url = `/audio/${lang}/${key}.mp3`
    if (await clipExists(url)) {
      const played = await playClip(url)
      if (played) continue
    }
    await speakText(translate(lang, key), lang)
  }
}
