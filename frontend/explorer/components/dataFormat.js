export function formatNumber(value, digits = 1) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })
    : '—'
}

export function formatDate(value) {
  if (!value) return '—'
  return new Date(value.length === 10 ? `${value}T00:00:00Z` : value)
    .toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function numbers(rows, field) {
  return rows.map((row) => row[field]).filter((value) => typeof value === 'number')
}

export function sum(rows, field) {
  const values = numbers(rows, field)
  return values.length ? values.reduce((total, value) => total + value, 0) : null
}

export function mean(rows, field) {
  const values = numbers(rows, field)
  return values.length ? sum(rows, field) / values.length : null
}

export function max(rows, field) {
  const values = numbers(rows, field)
  return values.length ? Math.max(...values) : null
}

export function latest(rows, field) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (typeof rows[index][field] === 'number') return rows[index][field]
  }
  return null
}

/** Start and end dates (YYYY-MM-DD) for the last `days` days, ending `lagDays` ago. */
export function recentRange(days, lagDays = 7) {
  const dayMs = 24 * 60 * 60 * 1000
  const end = new Date(Math.floor(Date.now() / dayMs) * dayMs - lagDays * dayMs)
  const start = new Date(end.getTime() - (days - 1) * dayMs)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}
