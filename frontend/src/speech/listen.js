// Voice dictation for the location field. The Web Speech API is not in every
// browser, so every caller must handle `supported === false` and fall back to
// typing.
//
// Recognition is trained on American and British English, so Gambian place
// names come back mangled ("Kerewan" -> "caravan"). We ask for several
// alternatives and let the backend's phonetic matcher pick the real place.

const Recognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition ?? window.webkitSpeechRecognition
    : undefined

export const dictationSupported = Boolean(Recognition)

/**
 * Listen once.
 * @param {{lang?: string, onInterim?: (text: string) => void}} options
 * @returns {{ stop: () => void, result: Promise<string[]> }}
 */
export function dictate({ lang = 'en-GB', onInterim } = {}) {
  if (!Recognition) {
    return { stop: () => {}, result: Promise.reject(new Error('unsupported')) }
  }

  const recognition = new Recognition()
  recognition.lang = lang
  recognition.interimResults = true
  recognition.maxAlternatives = 5
  recognition.continuous = false

  let settled = false

  const result = new Promise((resolve, reject) => {
    recognition.onresult = (event) => {
      const entry = event.results?.[event.results.length - 1]
      if (!entry) return

      if (!entry.isFinal) {
        onInterim?.(entry[0]?.transcript?.trim() ?? '')
        return
      }

      settled = true
      const alternatives = Array.from(entry)
        .map((alternative) => alternative.transcript?.trim() ?? '')
        .filter(Boolean)
      resolve(alternatives)
    }

    recognition.onerror = (event) => {
      settled = true
      reject(new Error(event.error ?? 'speech_error'))
    }

    recognition.onend = () => {
      if (!settled) reject(new Error('no_speech'))
    }

    try {
      recognition.start()
    } catch (error) {
      settled = true
      reject(error)
    }
  })

  return {
    stop: () => {
      try {
        recognition.stop()
      } catch {
        // Already stopped.
      }
    },
    result,
  }
}
