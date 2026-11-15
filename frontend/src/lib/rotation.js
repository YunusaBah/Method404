// Rotation maths for the planning screen. Everything here is a pure function so
// it can be tested without a browser, and every score is a *relative guide*
// ("this plan is kinder to your soil than that one"), never an agronomic claim.

import { traitFor } from '../data/traits'

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const round = (value) => Math.round(value)
const mean = (numbers) => numbers.reduce((total, value) => total + value, 0) / numbers.length

/** How well one crop likes the soil the farmer told us about. */
export function soilFit(cropId, soil) {
  if (!soil) return 'ok'
  const soils = traitFor(cropId).soils
  if (soils.includes(soil)) return 'good'
  // A crop with only one suitable soil (rice on clay) is fussy; heavy clay is
  // hard on crops that want free-draining ground.
  if (soils.length === 1 || soil === 'clay') return 'poor'
  return 'ok'
}

const FIT_BONUS = { good: 8, ok: 0, poor: -10 }

/**
 * Re-orders the API's ranking for what the farmer actually cares about.
 * With no soil or priority chosen this returns the API order untouched.
 */
export function rankCrops(crops, { priority = 'yield', soil = null } = {}) {
  return crops
    .map((crop) => {
      const fit = soilFit(crop.id, soil)
      const trait = traitFor(crop.id)
      let bonus = FIT_BONUS[fit]

      if (priority === 'water') bonus += (600 - (crop.waterNeedMm ?? 600)) / 25
      if (priority === 'soil') bonus += trait.soilDelta * 9
      if (priority === 'quick') bonus += (140 - (crop.seasonDays ?? 110)) / 8

      return {
        ...crop,
        fit,
        climateScore: crop.score ?? 0,
        score: clamp(round((crop.score ?? 0) + bonus), 0, 99),
      }
    })
    .sort((left, right) => right.score - left.score)
}

const WEIGHTS = {
  yield: { soil: 0.25, water: 0.25, variety: 0.25, speed: 0.25 },
  water: { soil: 0.15, water: 0.55, variety: 0.15, speed: 0.15 },
  soil: { soil: 0.6, water: 0.1, variety: 0.2, speed: 0.1 },
  quick: { soil: 0.15, water: 0.15, variety: 0.15, speed: 0.55 },
}

/**
 * Scores an ordered list of crops (one per season).
 * @param {object[]} plan crop objects from the recommendation, in planting order
 */
export function scorePlan(plan, { soil = null, priority = 'yield' } = {}) {
  const crops = plan.filter(Boolean)
  if (crops.length === 0) return null

  const traits = crops.map((crop) => traitFor(crop.id))
  const families = new Set(traits.map((trait) => trait.family))
  const roots = new Set(traits.map((trait) => trait.root))
  const nitrogen = traits.reduce((total, trait) => total + trait.soilDelta, 0)

  let repeated = 0
  for (let index = 1; index < traits.length; index += 1) {
    if (traits[index].family === traits[index - 1].family) repeated += 1
  }

  const hasLegume = traits.some((trait) => trait.family === 'legume')
  const legumeBeforeCereal = traits.some(
    (trait, index) =>
      trait.family === 'legume' &&
      traits.slice(index + 1).some((later) => later.family === 'cereal'),
  )
  const fits = crops.map((crop) => soilFit(crop.id, soil))
  const soilAdjustment = fits.reduce((total, fit) => total + FIT_BONUS[fit], 0)

  const soilScore = clamp(
    round(
      50 +
        nitrogen * 11 +
        (families.size - 1) * 8 +
        (legumeBeforeCereal ? 10 : 0) -
        repeated * 12 +
        soilAdjustment / crops.length,
    ),
  )

  const waterNeedMm = round(mean(crops.map((crop) => crop.waterNeedMm ?? 500)))
  const seasonDays = round(mean(crops.map((crop) => crop.seasonDays ?? 110)))
  const water = clamp(round(100 - (waterNeedMm - 350) / 9))
  const variety = clamp(round((families.size / crops.length) * 60 + (roots.size / crops.length) * 40))
  const speed = clamp(round(100 - (seasonDays - 80) / 2.5))

  const weights = WEIGHTS[priority] ?? WEIGHTS.yield
  const total = round(
    soilScore * weights.soil + water * weights.water + variety * weights.variety + speed * weights.speed,
  )

  return {
    soil: soilScore,
    water,
    variety,
    speed,
    total,
    waterNeedMm,
    seasonDays,
    nitrogen,
    flags: {
      hasLegume,
      legumeBeforeCereal,
      repeatedFamily: repeated > 0,
      allSameFamily: families.size === 1 && crops.length > 1,
      soilMismatch: fits.includes('poor'),
      longCover: traits.some((trait) => trait.cover === 'long'),
      shortPlan: crops.length < 2,
    },
    legumeCrop: crops.find((crop) => traitFor(crop.id).family === 'legume') ?? null,
  }
}

/** Plain-language reasons, as dictionary keys, for why a plan scored the way it did. */
export function planNotes(scored, soilLabel = null) {
  if (!scored) return []
  const { flags, legumeCrop } = scored
  const notes = []

  if (flags.shortPlan) notes.push({ key: 'rotation.note.short' })
  if (flags.legumeBeforeCereal) {
    notes.push({ key: 'rotation.note.legumeFirst' })
  } else if (flags.hasLegume && legumeCrop) {
    notes.push({ key: 'rotation.note.legume', params: { crop: legumeCrop.name } })
  } else if (!flags.hasLegume) {
    notes.push({ key: 'rotation.note.noLegume' })
  }
  if (scored.nitrogen > 0) notes.push({ key: 'rotation.note.builds' })
  if (flags.repeatedFamily) notes.push({ key: 'rotation.note.repeat' })
  if (scored.variety >= 80) notes.push({ key: 'rotation.note.variety' })
  if (flags.soilMismatch && soilLabel) {
    notes.push({ key: 'rotation.note.soil', params: { soil: soilLabel } })
  }
  if (flags.longCover) notes.push({ key: 'rotation.note.cover' })

  return notes
}

/** A sensible starting pair of plans: one that rotates, one that repeats. */
export function suggestedPlans(crops) {
  const byId = new Map(crops.map((crop) => [crop.id, crop]))
  const pick = (ids) => ids.map((id) => byId.get(id)).filter(Boolean)
  const legumes = crops.filter((crop) => traitFor(crop.id).family === 'legume').map((crop) => crop.id)
  const cereals = crops.filter((crop) => traitFor(crop.id).family === 'cereal').map((crop) => crop.id)
  const roots = crops.filter((crop) => traitFor(crop.id).family === 'root').map((crop) => crop.id)

  const rotating = pick([legumes[0], cereals[0], legumes[1] ?? legumes[0]])
  const repeating = pick([cereals[1] ?? cereals[0], cereals[2] ?? cereals[0], roots[0] ?? cereals[0]])

  return [
    rotating.length >= 2 ? rotating : crops.slice(0, 3),
    repeating.length >= 2 ? repeating : crops.slice(0, 2).reverse(),
  ]
}
