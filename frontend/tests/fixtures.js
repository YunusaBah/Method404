// A trimmed copy of what GET /api/recommend returns, so component and e2e
// tests never need NASA or the network.
const RAIN = [2, 2, 2, 1, 4, 53, 219, 304, 270, 101, 2, 10]

export const climate = RAIN.map((rainMm, index) => ({
  month: index + 1,
  rainMm,
  rainDays: rainMm > 20 ? 12 : 0,
  tMaxC: 28 + (index > 8 ? 1.5 : 0),
}))

const statuses = (good, marginal) =>
  Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    status: good.includes(index + 1) ? 'good' : marginal.includes(index + 1) ? 'marginal' : 'poor',
  }))

export const cowpea = {
  id: 'cowpea',
  name: 'Cowpea',
  score: 77,
  waterNeedMm: 380,
  waterMaxMm: 800,
  seasonDays: 80,
  heatLimitC: 40,
  months: statuses([6, 7, 8], [9]),
  bestMonths: [6, 7, 8],
  bestMonth: 7,
  rainInBestMonthMm: 793,
  tMaxInBestMonthC: 28.9,
  drySpellDays: 5,
  limiting: null,
}

export const millet = {
  id: 'millet',
  name: 'Millet',
  score: 64,
  waterNeedMm: 350,
  waterMaxMm: 1000,
  seasonDays: 95,
  heatLimitC: 42,
  months: statuses([7, 8], [6, 9]),
  bestMonths: [7, 8],
  bestMonth: 8,
  rainInBestMonthMm: 523,
  tMaxInBestMonthC: 29.1,
  drySpellDays: 7,
  limiting: null,
}

export const maize = {
  id: 'maize',
  name: 'Maize',
  score: 41,
  waterNeedMm: 600,
  waterMaxMm: 1000,
  seasonDays: 100,
  heatLimitC: 32,
  months: statuses([8], [7, 9]),
  bestMonths: [8],
  bestMonth: 8,
  rainInBestMonthMm: 523,
  tMaxInBestMonthC: 29.1,
  drySpellDays: 7,
  limiting: 'too_dry',
}

export const sorghum = {
  id: 'sorghum',
  name: 'Sorghum',
  score: 38,
  waterNeedMm: 450,
  waterMaxMm: 900,
  seasonDays: 110,
  heatLimitC: 38,
  months: statuses([8], [7, 9]),
  bestMonths: [8],
  bestMonth: 8,
  rainInBestMonthMm: 523,
  tMaxInBestMonthC: 29.1,
  drySpellDays: 9,
  limiting: 'too_wet',
}

export const payload = {
  location: { latitude: 13.4549, longitude: -16.579, district: 'Banjul' },
  source: 'NASA POWER',
  period: { start: '20230101', end: '20241031' },
  climate,
  crops: [cowpea, millet, maize, sorghum],
}

export const weatherPayload = {
  location: { latitude: 13.4549, longitude: -16.579, district: 'Banjul' },
  source: 'NASA POWER',
  period: { start: '20230101', end: '20241031' },
  current: { date: '2024-11-01', tMaxC: 33.1, tMinC: 22.4, tMeanC: 27.5, rainMm: 0, humidityPct: 71 },
  monthly: climate.map((month) => ({
    ...month,
    tMinC: month.tMaxC - 8,
    tMeanC: month.tMaxC - 4,
    humidityPct: 65,
  })),
  summary: {
    annualRainMm: 1043,
    wettestMonth: 8,
    driestMonth: 4,
    wetMonths: [6, 7, 8, 9, 10],
    dryMonths: [1, 2, 3, 4, 5, 11, 12],
    meanTMaxC: 28.9,
  },
}
