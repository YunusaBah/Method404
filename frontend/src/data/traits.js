// Rotation traits now come from the shared catalogue, which is generated from
// backend/src/data/crops.json by `npm run images` (see scripts/). There is only
// ONE list of crops in this project; this file just gives the browser an
// offline-first way to read it.
//
// The traits are teaching values, not a crop model: family (legume / cereal /
// root), whether a crop puts nitrogen back, root depth, ground-cover length and
// which soils suit it. The UI says so in plain words.

import catalogue from './catalogue.json'

export const SOILS = ['sandy', 'loam', 'clay']

export const PRIORITIES = ['yield', 'water', 'soil', 'quick']

export const CATEGORIES = ['annual', 'orchard']

const UNKNOWN = {
  family: 'other', soils: [], soilDelta: 0, cover: 'medium', root: 'shallow',
}

const BY_ID = new Map(catalogue.crops.map((crop) => [crop.id, crop]))

export function cropFromCatalogue(id) {
  return BY_ID.get(id) ?? null
}

export function traitFor(id) {
  return BY_ID.get(id)?.rotation ?? UNKNOWN
}

export function scoredIds() {
  return catalogue.crops.filter((crop) => crop.scored).map((crop) => crop.id)
}

export const bundledCatalogue = catalogue
