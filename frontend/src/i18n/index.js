import en from './en.json'
import mnk from './mnk.json'
import wo from './wo.json'
import ff from './ff.json'

const dictionaries = { en, mnk, wo, ff }

export const LANGUAGES = [
  { id: 'en', short: 'EN', label: 'English', native: 'English', speech: 'en-GB', complete: true },
  { id: 'mnk', short: 'MNK', label: 'Mandinka', native: 'Mandinka', speech: 'en-GB', complete: false },
  { id: 'wo', short: 'WO', label: 'Wolof', native: 'Wolof', speech: 'fr-FR', complete: true },
  { id: 'ff', short: 'FF', label: 'Pulaar', native: 'Pulaar', speech: 'fr-FR', complete: true },
]

export function languageById(id) {
  return LANGUAGES.find((language) => language.id === id) ?? LANGUAGES[0]
}

export function translate(language, key, params) {
  const table = dictionaries[language] ?? dictionaries.en
  const template = table[key] ?? dictionaries.en[key] ?? key
  if (!params) return template

  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  )
}

export function monthName(language, month) {
  return translate(language, `month.${month}`)
}

export function monthShort(language, month) {
  return translate(language, `month.short.${month}`)
}

export function monthShort3(language, month) {
  return translate(language, `month.short3.${month}`)
}
