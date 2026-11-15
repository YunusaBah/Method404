// Local, deliberately coarse agronomic traits for the seven crops.
//
// The weather API gives us each crop's water need, heat limit and season length.
// These extra fields are what make a *rotation* meaningful: which family a crop
// belongs to, whether it puts nitrogen back, how deep its roots go, how long it
// covers the ground, and which soils suit it. They are teaching values drawn
// from general agronomy, not a crop model — the UI says so in plain words.
//
// Keeping them in the browser means the rotation planner works with the data we
// already have and needs no new backend endpoint.

export const SOILS = ['sandy', 'loam', 'clay']

export const PRIORITIES = ['yield', 'water', 'soil', 'quick']

export const TRAITS = {
  groundnut: {
    family: 'legume', soils: ['sandy', 'loam'], soilDelta: 2, cover: 'medium', root: 'shallow',
  },
  cowpea: {
    family: 'legume', soils: ['sandy', 'loam'], soilDelta: 2, cover: 'short', root: 'shallow',
  },
  millet: {
    family: 'cereal', soils: ['sandy', 'loam'], soilDelta: -1, cover: 'medium', root: 'deep',
  },
  sorghum: {
    family: 'cereal', soils: ['sandy', 'loam', 'clay'], soilDelta: -1, cover: 'long', root: 'deep',
  },
  maize: {
    family: 'cereal', soils: ['loam', 'clay'], soilDelta: -2, cover: 'medium', root: 'shallow',
  },
  rice: {
    family: 'cereal', soils: ['clay'], soilDelta: -1, cover: 'long', root: 'shallow',
  },
  cassava: {
    family: 'root', soils: ['sandy', 'loam'], soilDelta: -2, cover: 'long', root: 'deep',
  },
}

const UNKNOWN = {
  family: 'other', soils: [], soilDelta: 0, cover: 'medium', root: 'shallow',
}

export function traitFor(id) {
  return TRAITS[id] ?? UNKNOWN
}
