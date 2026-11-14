import { useCallback } from 'react'
import { useAppState } from '../state/store'
import en from './en.json'
import ff from './ff.json'
import mnk from './mnk.json'
import wo from './wo.json'

const dictionaries = { en, ff, mnk, wo }

export const LANGUAGES = [
  { id: 'en', htmlLang: 'en' },
  { id: 'mnk', htmlLang: 'mnk' },
  { id: 'wo', htmlLang: 'wo' },
  { id: 'ff', htmlLang: 'ff' },
]

export function translate(lang, key, params) {
  const template = dictionaries[lang]?.[key] ?? en[key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name) => (
    name in params ? String(params[name]) : match
  ))
}

export function seasonLabel(lang, slot) {
  if (slot === 0) return translate(lang, 'season.this_year')
  if (slot === 1) return translate(lang, 'season.next_year')
  return translate(lang, 'season.year_n', { n: slot + 1 })
}

export function useT() {
  const { language } = useAppState()
  const t = useCallback(
    (key, params) => translate(language, key, params),
    [language],
  )
  return { t, language }
}
