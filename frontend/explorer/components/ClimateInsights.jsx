import { useState } from 'react'
import { apiClient } from '../services/api.js'

const parameters = [
  { key: 'T2M', label: 'Temperature', color: '#b8743d' },
  { key: 'PRECTOTCORR', label: 'Rainfall', color: '#5487a0' },
  { key: 'RH2M', label: 'Relative humidity', color: '#698c65' },
  {
    key: 'ALLSKY_SFC_SW_DWN',
    label: 'Solar radiation',
    color: '#c29b42',
  },
]

const metrics = [
  { key: 'averageTemperature', label: 'Average temperature' },
  { key: 'maximumTemperature', label: 'Maximum temperature' },
  { key: 'minimumTemperature', label: 'Minimum temperature' },
  { key: 'totalPrecipitation', label: 'Total precipitation' },
  { key: 'averageRelativeHumidity', label: 'Average relative humidity' },
  { key: 'averageSolarRadiation', label: 'Average solar radiation' },
]

function dateOffset(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

function formatValue(value, unit) {
  if (value === null || !Number.isFinite(value)) return 'No data'
  return `${Number(value.toFixed(1))} ${unit || ''}`.trim()
}

function ClimateChart({ observations, parameter }) {
  const series = observations
    .filter((item) => item.parameter === parameter.key)
    .sort((left, right) => left.date.localeCompare(right.date))
  const points = series.filter((item) => !item.missing && Number.isFinite(item.value))
  const width = 800
  const height = 190
  const padding = { top: 14, right: 12, bottom: 28, left: 12 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const values = points.map((point) => point.value)
  const unit = observations.find((item) => item.parameter === parameter.key && item.unit)?.unit
    || 'Unit unavailable'
  const minimum = values.length ? Math.min(...values) : 0
  const maximum = values.length ? Math.max(...values) : 1
  const range = maximum - minimum || 1
  const firstDay = series.length ? Date.parse(`${series[0].date}T00:00:00Z`) : 0
  const lastDay = series.length ? Date.parse(`${series[series.length - 1].date}T00:00:00Z`) : 0
  const dayRange = lastDay - firstDay
  const plotted = points.map((point) => ({
    ...point,
    x: padding.left + (dayRange === 0
      ? plotWidth / 2
      : ((Date.parse(`${point.date}T00:00:00Z`) - firstDay) / dayRange) * plotWidth),
    y: padding.top + plotHeight - ((point.value - minimum) / range) * plotHeight,
  }))
  const segments = []
  for (const point of plotted) {
    const previous = segments.at(-1)?.at(-1)
    if (!previous || Date.parse(`${point.date}T00:00:00Z`) - Date.parse(`${previous.date}T00:00:00Z`) !== 86400000) {
      segments.push([point])
    } else {
      segments.at(-1).push(point)
    }
  }

  return (
    <section aria-label={`${parameter.label} history`} className="climate-chart">
      <div className="climate-chart-heading">
        <h3>{parameter.label}</h3>
        <span>{unit}</span>
      </div>
      {points.length ? (
        <div className="climate-chart-plot">
          <svg
            aria-label={`${parameter.label} observations, ${points.length} available daily values`}
            className="climate-chart-svg"
            role="img"
            viewBox={`0 0 ${width} ${height}`}
          >
            {[0, 1, 2, 3].map((line) => {
              const y = padding.top + (plotHeight * line) / 3
              return <line key={line} className="climate-grid-line" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
            })}
            {segments.map((segment) => segment.length > 1 && (
              <polyline
                key={`${segment[0].date}-${segment[segment.length - 1].date}`}
                fill="none"
                points={segment.map((point) => `${point.x},${point.y}`).join(' ')}
                stroke={parameter.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
              />
            ))}
            {plotted.map((point) => (
              <circle
                key={`${point.date}-${point.parameter}`}
                cx={point.x}
                cy={point.y}
                fill={parameter.color}
                r="3"
              >
                <title>{`${point.date}: ${formatValue(point.value, point.unit)}`}</title>
              </circle>
            ))}
            <text className="climate-chart-date" textAnchor="start" x={padding.left} y={height - 5}>
              {series[0].date}
            </text>
            <text className="climate-chart-date" textAnchor="end" x={width - padding.right} y={height - 5}>
              {series[series.length - 1].date}
            </text>
          </svg>
          <div className="climate-chart-scale" aria-hidden="true">
            <span>{formatValue(maximum, unit)}</span>
            <span>{formatValue(minimum, unit)}</span>
          </div>
        </div>
      ) : (
        <p className="climate-chart-empty">No valid NASA observations for this parameter in the selected range.</p>
      )}
    </section>
  )
}

function ClimateInsights() {
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [start, setStart] = useState(dateOffset(34))
  const [end, setEnd] = useState(dateOffset(4))
  const [result, setResult] = useState(null)
  const [retrievedAt, setRetrievedAt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadClimate(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await apiClient.get('nasa/power/summary', {
        params: {
          latitude,
          longitude,
          start: start.replaceAll('-', ''),
          end: end.replaceAll('-', ''),
        },
        timeout: 20000,
      })
      setResult(data)
      setRetrievedAt(new Date())
    } catch (requestError) {
      setError(requestError.message || 'NASA POWER observations could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="section-page climate-insights-page">
      <div className="page-heading">
        <div>
          <div className="page-kicker"><span /> EARTH OBSERVATION <span className="kicker-divider">/</span> NASA POWER</div>
          <h1>Climate Insights</h1>
          <p>Daily climate observations for the coordinates you provide.</p>
        </div>
        <span className="page-date">NASA POWER Daily API</span>
      </div>

      <section aria-labelledby="climate-query-title" className="climate-query-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">LOCATION-SPECIFIC REQUEST</span>
            <h2 id="climate-query-title">Choose a farm location and date range</h2>
          </div>
        </div>
        <p className="panel-description">
          Enter your farm’s coordinates. No city or regional coordinate is substituted for a farm location.
        </p>
        <form className="climate-query-form" onSubmit={loadClimate}>
          <label>
            Latitude
            <input
              max="90"
              min="-90"
              name="latitude"
              onChange={(event) => setLatitude(event.target.value)}
              placeholder="e.g. 13.45"
              required
              step="any"
              type="number"
              value={latitude}
            />
          </label>
          <label>
            Longitude
            <input
              max="180"
              min="-180"
              name="longitude"
              onChange={(event) => setLongitude(event.target.value)}
              placeholder="e.g. -16.58"
              required
              step="any"
              type="number"
              value={longitude}
            />
          </label>
          <label>
            Start date
            <input
              max={end}
              onChange={(event) => setStart(event.target.value)}
              required
              type="date"
              value={start}
            />
          </label>
          <label>
            End date
            <input
              max={dateOffset(1)}
              min={start}
              onChange={(event) => setEnd(event.target.value)}
              required
              type="date"
              value={end}
            />
          </label>
          <button className="climate-submit-button" disabled={loading} type="submit">
            {loading ? 'Retrieving observations…' : 'Get NASA observations'}
          </button>
        </form>
        {error && <p aria-live="polite" className="climate-error" role="alert">{error}</p>}
        {loading && <p aria-live="polite" className="climate-loading">Requesting daily data from NASA POWER…</p>}
      </section>

      {result && (
        <>
          <section aria-label="NASA data provenance" className="climate-provenance">
            <div><span>Source</span><strong>{result.source}</strong></div>
            <div><span>Location</span><strong>{result.request.latitude}, {result.request.longitude}</strong></div>
            <div><span>Date range</span><strong>{result.request.start} – {result.request.end}</strong></div>
            <div><span>Last successful retrieval</span><strong>{retrievedAt?.toLocaleString() || '—'}</strong></div>
            {result.metadata.header?.sources?.length > 0 && (
              <div><span>NASA source datasets</span><strong>{result.metadata.header.sources.join(', ')}</strong></div>
            )}
            <p>{result.attribution}. Summaries are derived from available daily values; missing NASA values are excluded, not estimated.</p>
          </section>

          <section aria-labelledby="climate-summary-title" className="climate-summary-section">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">DERIVED FROM DAILY OBSERVATIONS</span>
                <h2 id="climate-summary-title">Period summary</h2>
              </div>
            </div>
            <div className="climate-metric-grid">
              {metrics.map((metric) => {
                const summary = result.summaries[metric.key]
                return (
                  <article className="climate-metric-card" key={metric.key}>
                    <span>{metric.label}</span>
                    <strong>{formatValue(summary.value, summary.unit)}</strong>
                    <small>{summary.aggregation}</small>
                  </article>
                )
              })}
            </div>
          </section>

          <section aria-labelledby="climate-history-title" className="climate-history-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">NASA DAILY VALUES</span>
                <h2 id="climate-history-title">Historical climate charts</h2>
              </div>
              <span className="source-state">{result.metadata.returnedDateCount} dates returned</span>
            </div>
            <div className="climate-chart-grid">
              {parameters.map((parameter) => (
                <ClimateChart
                  key={parameter.key}
                  observations={result.observations}
                  parameter={parameter}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default ClimateInsights
