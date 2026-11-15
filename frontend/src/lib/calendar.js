// Turns twelve months of crop suitability into the rows the planting calendar
// shows. Months with nothing to sow are folded into one range, so the dry season
// takes a single row instead of five identical ones.
export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export function groupMonths(crops, climate, months = MONTHS) {
  const rows = []

  for (const month of months) {
    const sowing = crops
      .filter((crop) => crop.months[month - 1]?.status === 'good')
      .sort((left, right) => right.score - left.score)
    const rain = climate?.[month - 1]?.rainMm ?? 0

    if (sowing.length > 0) {
      rows.push({ type: 'sow', from: month, to: month, crops: sowing, rain })
      continue
    }

    const last = rows.at(-1)
    if (last?.type === 'dry' && last.to === month - 1) {
      last.to = month
      last.rain += rain
    } else {
      rows.push({ type: 'dry', from: month, to: month, rain })
    }
  }

  return rows
}
