import { useState } from 'react'
import LoadState from './LoadState.jsx'
import LocationSelect from './LocationSelect.jsx'
import { formatDate, formatNumber, latest, max, mean, recentRange, sum } from './dataFormat.js'
import { useApiResource } from '../hooks/useApiResource.js'
import { fetchGambiaSourceData } from '../services/api.js'

const PERIODS = [
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 365, label: 'Last 12 months' },
]
const POWER_CLIMATE_PARAMETERS = [
  'PRECTOTCORR', 'T2M', 'T2M_MAX', 'T2M_MIN', 'RH2M', 'ALLSKY_SFC_SW_DWN', 'GWETTOP', 'GWETROOT',
].join(',')

function RainfallChart({ rows, field, label }) {
  const values = rows.map((row) => row[field])
  const peak = Math.max(1, ...values.filter((value) => typeof value === 'number'))
  const width = 600
  const height = 120
  const barWidth = width / Math.max(rows.length, 1)

  return (
    <figure className="rain-chart">
      <svg aria-label={`${label} daily rainfall`} preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
        <line className="rain-chart-axis" x1="0" x2={width} y1={height - 0.5} y2={height - 0.5} />
        {rows.map((row, index) => {
          const value = row[field]
          if (typeof value !== 'number' || value <= 0) return null
          const barHeight = Math.max(1.5, (value / peak) * (height - 6))
          return (
            <rect
              className="rain-chart-bar"
              height={barHeight}
              key={row.date}
              width={Math.max(barWidth - 1.5, 1)}
              x={index * barWidth + 0.75}
              y={height - barHeight}
            >
              <title>{`${formatDate(row.date)}: ${formatNumber(value)} mm`}</title>
            </rect>
          )
        })}
      </svg>
      <figcaption>
        <span>{formatDate(rows[0]?.date)}</span>
        <span>Daily rainfall, peak {formatNumber(peak)} mm</span>
        <span>{formatDate(rows.at(-1)?.date)}</span>
      </figcaption>
    </figure>
  )
}

function Stat({ label, value, unit, note }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <strong>{value}<small>{unit}</small></strong>
      {note && <span className="stat-note">{note}</span>}
    </div>
  )
}

function ClimateSourcePanel({ title, eyebrow, resource, fields, children }) {
  const rows = resource.data?.data.daily ?? []

  return (
    <section className="panel data-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {resource.status === 'success' && <span className="live-label">Live data</span>}
      </div>
      <LoadState resource={resource} />
      {resource.status === 'success' && (
        rows.length === 0 ? (
          <p className="load-state">No data was returned for this period.</p>
        ) : (
          <>
            <div className="stat-grid">
              <Stat label="Rain" unit=" mm" value={formatNumber(sum(rows, fields.rain))} />
              <Stat label="Average warmth" unit=" °C" value={formatNumber(mean(rows, fields.temp))} />
              <Stat label="Hottest day" unit=" °C" value={formatNumber(max(rows, fields.tempMax))} />
              {children(rows)}
            </div>
            <RainfallChart field={fields.rain} label={title} rows={rows} />
            <p className="source-caption">
              {title === 'NASA weather'
                ? 'NASA estimate for this area. It is not a field sensor reading.'
                : 'ERA5 weather record for this area.'}
            </p>
          </>
        )
      )}
    </section>
  )
}

function latestReading(rows, field, dateField = 'date') {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (typeof rows[index][field] === 'number') {
      return { value: rows[index][field], date: rows[index][dateField] }
    }
  }
  return null
}

function SoilMoisturePanel({ locationId, power, era5 }) {
  const smap = useApiResource(
    (signal) => fetchGambiaSourceData('smap', { location: locationId }, { signal }),
    [locationId],
  )
  const powerRows = power.data?.data?.daily ?? []
  const smapRows = smap.data?.data?.series ?? []
  const era5Rows = era5.data?.data?.daily ?? []
  const readings = [
    {
      label: 'NASA POWER · surface wetness',
      reading: latestReading(powerRows, 'GWETTOP'),
      unit: 'index',
      source: 'NASA estimate',
    },
    {
      label: 'NASA POWER · root-zone wetness',
      reading: latestReading(powerRows, 'GWETROOT'),
      unit: 'index',
      source: 'NASA estimate',
    },
    {
      label: 'NASA SMAP · morning, top 5 cm',
      reading: latestReading(smapRows, 'soilMoistureAm'),
      unit: 'percent',
      source: 'Satellite estimate',
    },
    {
      label: 'NASA SMAP · evening, top 5 cm',
      reading: latestReading(smapRows, 'soilMoisturePm'),
      unit: 'percent',
      source: 'Satellite estimate',
    },
    {
      label: 'ERA5 · topsoil, 0–7 cm',
      reading: latestReading(era5Rows, 'soil_moisture_0_to_7cm_mean'),
      unit: 'percent',
      source: 'Weather model estimate',
    },
    {
      label: 'ERA5 · deeper soil, 7–28 cm',
      reading: latestReading(era5Rows, 'soil_moisture_7_to_28cm_mean'),
      unit: 'percent',
      source: 'Weather model estimate',
    },
  ]
  const hasReading = readings.some(({ reading }) => reading)
  const smapNeedsToken = smap.status === 'success' && !Array.isArray(smap.data?.data?.series)

  return (
    <section aria-labelledby="soil-moisture-title" className="panel data-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SOIL WATER · ESTIMATES</span>
          <h2 id="soil-moisture-title">Soil moisture</h2>
        </div>
        {hasReading && <span className="live-label">Recent readings</span>}
      </div>
      <div className="stat-grid">
        {readings.map(({ label, reading, source, unit }) => (
          <div className="stat-tile" key={label}>
            <span className="stat-label">{label}</span>
            <strong>
              {formatNumber(reading ? (unit === 'percent' ? reading.value * 100 : reading.value) : null)}
              <small>{unit === 'percent' ? ' %' : ' / 1'}</small>
            </strong>
            <span className="stat-note">
              {reading ? `${formatDate(reading.date)} · ${source}` : 'No recent reading'}
            </span>
          </div>
        ))}
      </div>
      <p className="source-caption">
        SMAP and ERA5 show water in soil by volume (%). NASA POWER uses a wetness index from 0 to 1.
        These are estimates, not readings from your field.
      </p>
      {smapNeedsToken && (
        <p className="source-caption">
          NASA SMAP readings need a NASA Earthdata Login token in the backend. ERA5 estimates are shown when available.
        </p>
      )}
      {smap.status === 'error' && (
        <p className="source-caption">NASA SMAP could not load: {smap.error}</p>
      )}
      {era5.status === 'error' && !hasReading && (
        <p className="source-caption">ERA5 soil estimates could not load: {era5.error}</p>
      )}
      {!hasReading && smap.status !== 'loading' && era5.status !== 'loading' && (
        <p className="source-caption">No soil-moisture readings are available for this place and period.</p>
      )}
    </section>
  )
}

function DailyTable({ power, era5 }) {
  const byDate = new Map()
  for (const row of power) byDate.set(row.date, { date: row.date, power: row })
  for (const row of era5) byDate.set(row.date, { ...byDate.get(row.date), date: row.date, era5: row })
  const rows = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <section className="panel data-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">DAY BY DAY</span>
          <h2>Daily values, newest first</h2>
        </div>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th rowSpan="2">Date</th>
              <th colSpan="4">NASA POWER</th>
              <th colSpan="4">ERA5</th>
            </tr>
            <tr>
              <th>Rain mm</th><th>Max °C</th><th>Min °C</th><th>Humidity %</th>
              <th>Rain mm</th><th>Max °C</th><th>Min °C</th><th>ET₀ mm</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ date, power: p = {}, era5: e = {} }) => (
              <tr key={date}>
                <th scope="row">{formatDate(date)}</th>
                <td>{formatNumber(p.PRECTOTCORR)}</td>
                <td>{formatNumber(p.T2M_MAX)}</td>
                <td>{formatNumber(p.T2M_MIN)}</td>
                <td>{formatNumber(p.RH2M)}</td>
                <td>{formatNumber(e.precipitation_sum)}</td>
                <td>{formatNumber(e.temperature_2m_max)}</td>
                <td>{formatNumber(e.temperature_2m_min)}</td>
                <td>{formatNumber(e.et0_fao_evapotranspiration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ClimatePage({ section, region, locationId, onLocationChange, onNavigate }) {
  const [days, setDays] = useState(30)
  const range = recentRange(days)
  const params = { location: locationId, ...range }
  const powerParams = { ...params, parameters: POWER_CLIMATE_PARAMETERS }
  const location = region.data?.locations.find((candidate) => candidate.id === locationId)

  const power = useApiResource(
    (signal) => fetchGambiaSourceData('power', powerParams, { signal }),
    [locationId, range.start, range.end],
  )
  const era5 = useApiResource(
    (signal) => fetchGambiaSourceData('era5', params, { signal }),
    [locationId, range.start, range.end],
  )

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <div className="page-kicker"><span /> FARM PLANNING <span className="kicker-divider">/</span> THE GAMBIA</div>
          <h1>{section.label}</h1>
          <p>
            Weather near {location ? `${location.name}, ${location.region}` : 'your location'}.
            Choose a place and time to see rain, heat and air moisture.
          </p>
        </div>
        <div className="page-controls">
          <LocationSelect locations={region.data?.locations} onChange={onLocationChange} value={locationId} />
          <label className="location-select">
            <span>Period</span>
            <select onChange={(event) => setDays(Number(event.target.value))} value={days}>
              {PERIODS.map((period) => <option key={period.days} value={period.days}>{period.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <p className="range-note">Showing weather from {formatDate(range.start)} to {formatDate(range.end)}.</p>

      <nav aria-label="Farm tools" className="quick-actions">
        <button onClick={() => onNavigate('recommendations')} type="button">Crop advice <span aria-hidden="true">→</span></button>
        <button onClick={() => onNavigate('rotation')} type="button">Plan my crops <span aria-hidden="true">→</span></button>
        <button onClick={() => onNavigate('environmental-data')} type="button">See data sources <span aria-hidden="true">→</span></button>
      </nav>

      <div className="two-column-grid">
        <ClimateSourcePanel
          eyebrow="NASA POWER · WEATHER ESTIMATE"
          fields={{ rain: 'PRECTOTCORR', temp: 'T2M', tempMax: 'T2M_MAX' }}
          resource={power}
          title="NASA weather"
        >
          {(rows) => (
            <>
              <Stat label="Air moisture" unit=" %" value={formatNumber(latest(rows, 'RH2M'))} />
              <Stat
                label="Sunlight"
                unit=" MJ/m²/day"
                value={formatNumber(mean(rows, 'ALLSKY_SFC_SW_DWN'))}
              />
            </>
          )}
        </ClimateSourcePanel>
        <ClimateSourcePanel
          eyebrow="ERA5 · WEATHER RECORD"
          fields={{ rain: 'precipitation_sum', temp: 'temperature_2m_mean', tempMax: 'temperature_2m_max' }}
          resource={era5}
          title="ERA5"
        >
          {(rows) => (
            <Stat
              label="Water plants may need"
              unit=" mm"
              note="Weather-based estimate"
              value={formatNumber(sum(rows, 'et0_fao_evapotranspiration'))}
            />
          )}
        </ClimateSourcePanel>
      </div>

      <SoilMoisturePanel era5={era5} locationId={locationId} power={power} />

      {power.status === 'success' && era5.status === 'success' && (
        <details className="daily-records">
          <summary>See daily weather records</summary>
          <DailyTable era5={era5.data.data.daily} power={power.data.data.daily} />
        </details>
      )}
    </div>
  )
}

export default ClimatePage
