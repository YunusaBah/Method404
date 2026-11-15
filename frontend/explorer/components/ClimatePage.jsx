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
              <Stat label="Total rainfall" unit=" mm" value={formatNumber(sum(rows, fields.rain))} />
              <Stat label="Mean temperature" unit=" °C" value={formatNumber(mean(rows, fields.temp))} />
              <Stat label="Hottest day" unit=" °C" value={formatNumber(max(rows, fields.tempMax))} />
              {children(rows)}
            </div>
            <RainfallChart field={fields.rain} label={title} rows={rows} />
            <ul className="note-list">
              {resource.data.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </>
        )
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
              <th>Rain mm</th><th>Max °C</th><th>Min °C</th><th>Root-zone wetness</th>
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
                <td>{formatNumber(p.GWETROOT, 2)}</td>
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

function ClimatePage({ section, region, locationId, onLocationChange }) {
  const [days, setDays] = useState(30)
  const range = recentRange(days)
  const params = { location: locationId, ...range }
  const location = region.data?.locations.find((candidate) => candidate.id === locationId)

  const power = useApiResource(
    (signal) => fetchGambiaSourceData('power', params, { signal }),
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
            Rainfall, temperature and soil moisture for {location ? `${location.name}, ${location.region}` : 'your location'},
            from two independent climate records.
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

      <p className="range-note">
        {formatDate(range.start)} to {formatDate(range.end)}. The most recent week is left out because both sources
        take several days to publish.
      </p>

      <div className="two-column-grid">
        <ClimateSourcePanel
          eyebrow="NASA POWER · SATELLITE AND MODEL"
          fields={{ rain: 'PRECTOTCORR', temp: 'T2M', tempMax: 'T2M_MAX' }}
          resource={power}
          title="NASA POWER"
        >
          {(rows) => (
            <Stat
              label="Root-zone soil wetness"
              note="0 is dry, 1 is saturated"
              value={formatNumber(latest(rows, 'GWETROOT'), 2)}
            />
          )}
        </ClimateSourcePanel>
        <ClimateSourcePanel
          eyebrow="ERA5 · ECMWF REANALYSIS"
          fields={{ rain: 'precipitation_sum', temp: 'temperature_2m_mean', tempMax: 'temperature_2m_max' }}
          resource={era5}
          title="ERA5"
        >
          {(rows) => (
            <Stat
              label="Crop water demand (ET₀)"
              unit=" mm"
              note="Total reference evapotranspiration"
              value={formatNumber(sum(rows, 'et0_fao_evapotranspiration'))}
            />
          )}
        </ClimateSourcePanel>
      </div>

      {power.status === 'success' && era5.status === 'success' && (
        <DailyTable era5={era5.data.data.daily} power={power.data.data.daily} />
      )}
    </div>
  )
}

export default ClimatePage
