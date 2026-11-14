/**
 * Deterministic mock of the agronomy engine.
 *
 * The real engine will read NASA POWER observations, soil rasters and crop
 * traits. This mock only has to be plausible and, above all, deterministic:
 * the same farm profile and scenario must always produce the same plan so the
 * UI can be built and tested against it.
 */

export const CROPS = [
  'groundnut',
  'cowpea',
  'millet',
  'sorghum',
  'maize',
  'rice',
  'cassava',
]

const TRAITS = {
  groundnut: { family: 'legume', legume: true, water: 2, duration: 110, heat: 2 },
  cowpea: { family: 'legume', legume: true, water: 1, duration: 80, heat: 4 },
  millet: { family: 'cereal', legume: false, water: 1, duration: 95, heat: 5 },
  sorghum: { family: 'cereal', legume: false, water: 2, duration: 120, heat: 4 },
  maize: { family: 'cereal', legume: false, water: 3, duration: 100, heat: 2 },
  rice: { family: 'cereal', legume: false, water: 4, duration: 130, heat: 3 },
  cassava: { family: 'root', legume: false, water: 2, duration: 300, heat: 4 },
}

const SOIL_FIT = {
  sandy: {
    groundnut: 1,
    cowpea: 0.95,
    millet: 0.9,
    sorghum: 0.75,
    maize: 0.55,
    rice: 0.2,
    cassava: 0.7,
  },
  loam: {
    groundnut: 0.9,
    cowpea: 0.85,
    millet: 0.8,
    sorghum: 0.95,
    maize: 1,
    rice: 0.65,
    cassava: 0.85,
  },
  clay: {
    groundnut: 0.6,
    cowpea: 0.55,
    millet: 0.5,
    sorghum: 0.7,
    maize: 0.75,
    rice: 1,
    cassava: 0.7,
  },
}

const DISTRICTS = [
  { id: 'banjul', name: 'Banjul', defaultSoil: 'sandy', lat: 13.4549, lon: -16.579 },
  { id: 'kanifing', name: 'Kanifing', defaultSoil: 'sandy', lat: 13.4432, lon: -16.6667 },
  { id: 'brikama', name: 'Brikama', defaultSoil: null, lat: 13.2667, lon: -16.65 },
  { id: 'mansakonko', name: 'Mansakonko', defaultSoil: 'loam', lat: 13.4667, lon: -15.6667 },
  { id: 'kerewan', name: 'Kerewan', defaultSoil: 'sandy', lat: 13.5, lon: -16.0833 },
  { id: 'kuntaur', name: 'Kuntaur', defaultSoil: 'clay', lat: 13.6667, lon: -14.8833 },
  { id: 'janjanbureh', name: 'Janjanbureh', defaultSoil: 'clay', lat: 13.5333, lon: -14.7667 },
  { id: 'basse', name: 'Basse', defaultSoil: null, lat: 13.3167, lon: -14.2167 },
]

const SEASON_WEEKS = 18
const YEARS = 10

function hash(value) {
  let h = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (degrees) => (degrees * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function soilFit(soil, crop) {
  if (soil === 'unknown') return 0.6
  return SOIL_FIT[soil][crop]
}

function waterFit(water, crop) {
  if (water === 'lowland') return crop === 'rice' ? 1 : 0.75
  if (water === 'irrigated') return crop === 'rice' || crop === 'maize' ? 1 : 0.9
  return crop === 'rice' ? 0.15 : 1
}

function priorityBoost(crop, priorities) {
  const trait = TRAITS[crop]
  let boost = 0
  for (const priority of priorities) {
    if (priority === 'water') boost += (5 - trait.water) * 0.25
    if (priority === 'soil') boost += trait.legume ? 1 : 0.2
    if (priority === 'income') boost += crop === 'groundnut' || crop === 'maize' ? 0.8 : 0.1
    if (priority === 'food') boost += trait.family === 'cereal' ? 0.6 : 0.2
    if (priority === 'labor') boost += trait.duration > 120 ? 0.5 : 0.3
    if (priority === 'risk') boost += trait.heat * 0.15
  }
  return boost
}

function pressureFor(scenario) {
  const rain = scenario.dRainPct < 0
    ? Math.min(1, Math.abs(scenario.dRainPct) / 40)
    : 0
  const heat = Math.min(1, Math.max(0, scenario.dTempC) / 3)
  return { rain, heat }
}

function outcomesFor(profile, scenario, crop, slot) {
  const pressure = pressureFor(scenario)
  const fit = soilFit(profile.soil, crop) * 0.62 + waterFit(profile.water, crop) * 0.18
  const heatTolerance = TRAITS[crop].heat / 5
  const outcomes = []

  for (let year = 0; year < YEARS; year += 1) {
    const noise = hash(
      `${profile.cellId}|${profile.soil}|${profile.water}|${crop}|${slot}|${year}`
        + `|${scenario.dRainPct}|${scenario.dTempC}`,
    )
    const quality = 0.1
      + fit * 0.56
      + (1 - pressure.rain) * 0.12
      + (1 - pressure.heat) * 0.08
      + (1 - heatTolerance) * -0.06
      + noise * 0.2
    const goodLine = 0.56 + pressure.rain * 0.2 + pressure.heat * 0.14
    const poorLine = 0.32 + pressure.rain * 0.22 + pressure.heat * 0.16
    outcomes.push(quality >= goodLine ? 'good' : quality >= poorLine ? 'poor' : 'failed')
  }

  return outcomes
}

function rainWeeklyFor(profile, scenario, crop, slot) {
  const peak = 4 + Math.round(hash(`${profile.cellId}|peak|${crop}|${slot}`) * 6)
  const multiplier = Math.max(0.2, 1 + scenario.dRainPct / 100)
  const weeks = []

  for (let week = 0; week < SEASON_WEEKS; week += 1) {
    const curve = Math.exp(-((week - peak) ** 2) / 16)
    const wetness = 0.35 + hash(`${profile.cellId}|rain|${crop}|${slot}|${week}`) * 0.65
    const millimetres = Math.round(curve * 44 * wetness * multiplier)
    weeks.push(millimetres > 3 ? millimetres : 0)
  }

  return weeks
}

function confidenceFor(outcomes) {
  const failed = outcomes.filter((outcome) => outcome === 'failed').length
  return failed >= 4 ? 'low' : 'ok'
}

function sequenceScore(crops, profile, scenario) {
  const pressure = pressureFor(scenario)
  let score = 0

  crops.forEach((crop, index) => {
    const trait = TRAITS[crop]
    score += soilFit(profile.soil, crop) * 3
    score += waterFit(profile.water, crop) * 1.5
    score += (5 - trait.water) * 0.2
    score += priorityBoost(crop, profile.priorities)
    score -= pressure.rain * trait.water * 0.6
    score -= pressure.heat * (5 - trait.heat) * 0.35

    if (trait.legume) score += 1.3
    if (index > 0) {
      const previous = TRAITS[crops[index - 1]]
      if (previous.legume && trait.family === 'cereal') score += 2.4
      if (previous.family === trait.family) score -= 2.2
      if (crops[index - 1] === crop) score -= 3
    }
  })

  return score
}

function buildSequence(crops, profile, scenario, fixed) {
  const slots = crops.map((crop, slot) => {
    const outcomes = outcomesFor(profile, scenario, crop, slot)
    return {
      slot,
      crop,
      outcomes,
      rainWeekly: rainWeeklyFor(profile, scenario, crop, slot),
      confidence: confidenceFor(outcomes),
      pinned: fixed[slot] !== undefined,
    }
  })
  return { slots }
}

function candidatesFor(seasons, fixed) {
  const results = []

  const walk = (acc) => {
    if (acc.length === seasons) {
      results.push(acc)
      return
    }
    const pinned = fixed[acc.length]
    const options = pinned ? [pinned] : CROPS
    for (const crop of options) {
      walk([...acc, crop])
    }
  }

  walk([])
  return results
}

function reasonsFor(crops) {
  const reasons = []
  const legumeBeforeCereal = crops.some((crop, index) => (
    index > 0
    && TRAITS[crops[index - 1]].legume
    && TRAITS[crop].family === 'cereal'
  ))
  const sameFamily = crops.some((crop, index) => (
    index > 0 && TRAITS[crops[index - 1]].family === TRAITS[crop].family
  ))

  if (legumeBeforeCereal) reasons.push({ code: 'legume_before_cereal', params: {} })
  if (sameFamily) reasons.push({ code: 'same_family_twice', params: {} })
  if (crops.every((crop) => TRAITS[crop].water <= 2)) {
    reasons.push({ code: 'water_need_low', params: {} })
  }
  if (crops.some((crop) => TRAITS[crop].water >= 3)) {
    reasons.push({ code: 'dry_spells_risk', params: {} })
  }
  if (crops.some((crop) => TRAITS[crop].duration > 120)) {
    reasons.push({ code: 'season_too_short', params: {} })
  }

  return reasons.slice(0, 3)
}

function detailsFor(sequence) {
  const rows = sequence.slots.flatMap((slot) => {
    const trait = TRAITS[slot.crop]
    const rain = slot.rainWeekly.reduce((total, value) => total + value, 0)
    const good = slot.outcomes.filter((outcome) => outcome === 'good').length
    return [
      {
        slot: slot.slot,
        label: 'Rain in the season',
        value: `${rain} mm`,
        tag: 'observed',
        source: 'NASA POWER (mock)',
      },
      {
        slot: slot.slot,
        label: 'Days to harvest',
        value: `${trait.duration} days`,
        tag: 'derived',
        source: 'Crop traits',
      },
      {
        slot: slot.slot,
        label: 'Good years in the record',
        value: `${good} of ${YEARS}`,
        tag: 'modeled',
        source: 'Mock engine',
      },
    ]
  })

  return { rows }
}

function planImpl(profile, scenario, fixed = {}) {
  const missing = []
  if (!profile.cellId) missing.push('location')
  if (profile.soil === 'unknown') missing.push('soil')
  if (!profile.water) missing.push('water')
  if (missing.length > 0) return { status: 'insufficient', missing }

  const seasons = Math.min(3, Math.max(1, profile.seasons || 3))
  const candidates = candidatesFor(seasons, fixed)
  const ranked = candidates
    .map((crops) => ({
      crops,
      score: sequenceScore(crops, profile, scenario),
    }))
    .sort((left, right) => right.score - left.score)

  const bestCrops = ranked[0]?.crops ?? ['groundnut', 'millet', 'cowpea']
  const best = buildSequence(bestCrops, profile, scenario, fixed)
  const alternatives = ranked
    .slice(1)
    .filter((entry) => entry.crops.join('|') !== bestCrops.join('|'))
    .slice(0, 4)
    .map((entry) => buildSequence(entry.crops, profile, scenario, {}))

  return {
    status: 'ok',
    best,
    alternatives,
    reasons: reasonsFor(bestCrops),
    changedSlots: [],
    hypothetical: scenario.dRainPct !== 0 || scenario.dTempC !== 0,
    details: detailsFor(best),
  }
}

function slotOptionsImpl(profile, scenario, slot, fixed = {}) {
  const seasons = Math.min(3, Math.max(1, profile.seasons || 3))
  const baseline = planImpl(profile, scenario, fixed)
  if (baseline.status !== 'ok') return []

  const baseCrops = baseline.best.slots.map((entry) => entry.crop)
  const current = baseCrops[slot]
  const options = CROPS
    .filter((crop) => crop !== current)
    .map((crop) => {
      const crops = baseCrops.slice(0, seasons)
      crops[slot] = crop
      return { crop, score: sequenceScore(crops, profile, scenario) }
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)

  return options.map((option) => ({
    crop: option.crop,
    outcomes: outcomesFor(profile, scenario, option.crop, slot),
  }))
}

export function createMockEngine() {
  const districts = DISTRICTS.map(({ id, name, defaultSoil }) => ({
    id,
    name,
    defaultSoil,
  }))

  return {
    districts: () => districts,

    nearestCell(lat, lon) {
      let closest = null
      let closestDistance = Number.POSITIVE_INFINITY
      for (const district of DISTRICTS) {
        const distance = distanceKm(lat, lon, district.lat, district.lon)
        if (distance < closestDistance) {
          closest = district
          closestDistance = distance
        }
      }
      if (!closest || closestDistance > 250) return null
      return { cellId: closest.id, districtId: closest.id }
    },

    plan: async (profile, scenario, fixed) => planImpl(profile, scenario, fixed),

    slotOptions: async (profile, scenario, slot, fixed) => (
      slotOptionsImpl(profile, scenario, slot, fixed)
    ),
  }
}
