// @vitest-environment node
import { describe, expect, it } from 'vitest'
import en from '../src/i18n/en.json'
import ff from '../src/i18n/ff.json'
import wo from '../src/i18n/wo.json'
import { LANGUAGES, monthName, monthShort, translate } from '../src/i18n'

describe('translation', () => {
  it('reads English strings from the dictionary', () => {
    expect(translate('en', 'hero.title')).toBe('Know what to plant, and when.')
  })

  it('uses the available translations and falls back for untranslated Mandinka', () => {
    expect(translate('wo', 'hero.title')).not.toBe(translate('en', 'hero.title'))
    expect(translate('ff', 'hero.title')).not.toBe(translate('en', 'hero.title'))
    expect(translate('mnk', 'hero.title')).toBe('Know what to plant, and when.')
    expect(translate('ff', 'results.best')).not.toBe(translate('en', 'results.best'))
    expect(LANGUAGES.find((language) => language.id === 'mnk').complete).toBe(false)
    expect(LANGUAGES.find((language) => language.id === 'wo').complete).toBe(true)
    expect(LANGUAGES.find((language) => language.id === 'ff').complete).toBe(true)
  })

  it('covers every English key and preserves dynamic parameters in Wolof and Pulaar', () => {
    for (const dictionary of [wo, ff]) {
      expect(Object.keys(dictionary).sort()).toEqual(Object.keys(en).sort())
      for (const [key, template] of Object.entries(en)) {
        const parameters = [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
        const translatedParameters = [...dictionary[key].matchAll(/\{(\w+)\}/g)]
          .map((match) => match[1])
          .sort()
        expect(translatedParameters, key).toEqual(parameters)
      }
    }
  })

  it('fills in named parameters', () => {
    expect(translate('en', 'results.match', { score: 77 })).toBe('77% match')
    expect(translate('en', 'results.all', { count: 7 })).toBe('See all 7 crops')
  })

  it('returns the key when a string is missing everywhere', () => {
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist')
  })

  it('names all twelve months in long and short form', () => {
    for (let month = 1; month <= 12; month += 1) {
      expect(monthName('en', month)).toMatch(/^[A-Z][a-z]+$/)
      expect(monthShort('en', month)).toHaveLength(1)
    }
    expect(monthName('en', 7)).toBe('July')
  })

  it('has a word for each month status', () => {
    for (const status of ['good', 'marginal', 'poor']) {
      expect(translate('en', `status.${status}`)).not.toBe(`status.${status}`)
    }
  })
})
