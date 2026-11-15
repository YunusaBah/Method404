// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { planNotes, rankCrops, scorePlan, soilFit, suggestedPlans } from '../src/lib/rotation'
import { cowpea, maize, millet, sorghum } from './fixtures'

const crops = [cowpea, millet, maize, sorghum]

describe('soilFit', () => {
  it('stays neutral until the farmer tells us the soil', () => {
    expect(soilFit('rice', null)).toBe('ok')
  })

  it('matches crops to the ground they like', () => {
    expect(soilFit('groundnut', 'sandy')).toBe('good')
    expect(soilFit('rice', 'clay')).toBe('good')
    expect(soilFit('rice', 'sandy')).toBe('poor')
    expect(soilFit('cowpea', 'clay')).toBe('poor')
    expect(soilFit('maize', 'sandy')).toBe('ok')
  })
})

describe('rankCrops', () => {
  it('leaves the API ranking alone when nothing is chosen', () => {
    expect(rankCrops(crops).map((crop) => crop.id)).toEqual(['cowpea', 'millet', 'maize', 'sorghum'])
    expect(rankCrops(crops)[0].score).toBe(77)
  })

  it('rewards legumes when the farmer wants to build soil', () => {
    expect(rankCrops([millet, cowpea], { priority: 'soil' })[0].id).toBe('cowpea')
  })

  it('rewards a short season when the farmer wants a quick harvest', () => {
    expect(rankCrops([cowpea], { priority: 'quick' })[0].score).toBe(85)
  })

  it('penalises a crop that does not suit the chosen soil', () => {
    const ranked = rankCrops([cowpea], { soil: 'clay' })
    expect(ranked[0].fit).toBe('poor')
    expect(ranked[0].score).toBe(67)
  })

  it('does not mutate the API payload', () => {
    rankCrops(crops, { priority: 'soil', soil: 'clay' })
    expect(cowpea.score).toBe(77)
    expect(cowpea.fit).toBeUndefined()
  })
})

describe('scorePlan', () => {
  it('returns nothing for an empty plan', () => {
    expect(scorePlan([])).toBeNull()
  })

  it('scores a legume-then-cereal rotation well above repeated cereals', () => {
    const rotating = scorePlan([cowpea, millet])
    const repeating = scorePlan([millet, maize])

    expect(rotating.soil).toBeGreaterThan(repeating.soil + 50)
    expect(rotating.total).toBeGreaterThan(repeating.total)
    expect(rotating.flags.legumeBeforeCereal).toBe(true)
    expect(repeating.flags.repeatedFamily).toBe(true)
    expect(repeating.flags.allSameFamily).toBe(true)
    expect(repeating.flags.hasLegume).toBe(false)
  })

  it('reports the water and time a plan needs each season', () => {
    const scored = scorePlan([cowpea, millet])
    expect(scored.waterNeedMm).toBe(365)
    expect(scored.seasonDays).toBe(88)
  })

  it('responds to the farmer priority', () => {
    const waterFirst = scorePlan([cowpea, millet], { priority: 'water' })
    const soilFirst = scorePlan([millet, maize], { priority: 'soil' })

    expect(waterFirst.water).toBe(98)
    expect(soilFirst.total).toBeLessThan(waterFirst.total)
  })

  it('marks a crop that fights the chosen soil', () => {
    expect(scorePlan([cowpea, millet], { soil: 'clay' }).flags.soilMismatch).toBe(true)
  })
})

describe('planNotes', () => {
  it('explains a legume-first rotation in plain words', () => {
    const keys = planNotes(scorePlan([cowpea, millet])).map((note) => note.key)
    expect(keys).toContain('rotation.note.legumeFirst')
    expect(keys).toContain('rotation.note.variety')
  })

  it('warns when a plan repeats a family and has no legume', () => {
    const keys = planNotes(scorePlan([millet, maize])).map((note) => note.key)
    expect(keys).toContain('rotation.note.noLegume')
    expect(keys).toContain('rotation.note.repeat')
  })

  it('names the soil when crops do not suit it', () => {
    const notes = planNotes(scorePlan([cowpea, millet], { soil: 'clay' }), 'clay')
    expect(notes).toContainEqual({ key: 'rotation.note.soil', params: { soil: 'clay' } })
  })

  it('returns nothing for an empty plan', () => {
    expect(planNotes(null)).toEqual([])
  })
})

describe('suggestedPlans', () => {
  it('offers one rotation that alternates families and one that repeats', () => {
    const [a, b] = suggestedPlans(crops)

    expect(a).toHaveLength(3)
    expect(b).toHaveLength(3)
    expect(scorePlan(a).soil).toBeGreaterThan(scorePlan(b).soil)
  })

  it('still works with only two crops available', () => {
    const [a, b] = suggestedPlans([cowpea, millet])
    expect(a.length).toBeGreaterThanOrEqual(2)
    expect(b.length).toBeGreaterThanOrEqual(2)
  })
})
