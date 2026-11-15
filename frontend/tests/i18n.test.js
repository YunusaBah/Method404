// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { monthName, monthShort, translate } from '../src/i18n'

describe('translation', () => {
  it('reads English strings from the dictionary', () => {
    expect(translate('en', 'hero.title')).toBe('Know what to plant, and when.')
  })

  it('falls back to English when a language has no entry yet', () => {
    expect(translate('mnk', 'hero.title')).toBe('Know what to plant, and when.')
    expect(translate('ff', 'results.best')).toBe('Best match')
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
