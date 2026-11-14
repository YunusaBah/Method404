import { describe, expect, it } from 'vitest'
import { seasonLabel, translate } from '../src/i18n'

describe('translation', () => {
  it('reads English strings from the dictionary', () => {
    expect(translate('en', 'plan.title')).toBe('Best plan for your farm')
  })

  it('falls back to English when a language has no entry yet', () => {
    expect(translate('mnk', 'plan.title')).toBe('Best plan for your farm')
    expect(translate('wo', 'plan.other')).toBe('Other plans')
  })

  it('fills in named parameters', () => {
    expect(translate('en', 'plan.good_in', { n: 7 })).toBe('Good in 7 of 10 past seasons')
  })

  it('returns the key when a string is missing everywhere', () => {
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist')
  })

  it('labels the seasons in order', () => {
    expect(seasonLabel('en', 0)).toBe('This year')
    expect(seasonLabel('en', 1)).toBe('Next year')
    expect(seasonLabel('en', 2)).toBe('Year 3')
  })
})
