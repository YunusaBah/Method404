import { useState } from 'react'
import LoadState from './LoadState.jsx'
import LocationSelect from './LocationSelect.jsx'
import { formatNumber } from './dataFormat.js'
import { useApiResource } from '../hooks/useApiResource.js'
import { fetchGambiaRotation } from '../services/api.js'

// Rain-fed crops the backend accepts as the previous season's crop.
const PREVIOUS_CROPS = ['Groundnut', 'Pearl millet', 'Sorghum', 'Maize', 'Dryland rice', 'Cowpea', 'Cassava', 'Sweet potato']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ROLE_LABELS = { cereal: 'Cereal', legume: 'Legume', root: 'Root crop', vegetable: 'Vegetable' }

function monthDayLabel(value) {
  if (!value) return '—'
  const [month, day] = value.split('-').map(Number)
  return `${day} ${MONTHS[month - 1]}`
}

function isInSeason(monthIndex, start, end) {
  if (!start || !end) return false
  const mid = (monthIndex + 1) * 100 + 15
  const from = Number(start.replace('-', ''))
  const to = Number(end.replace('-', ''))
  return from <= to ? mid >= from && mid <= to : mid >= from || mid <= to
}

function SeasonChart({ season }) {
  const months = season.months
  const peak = Math.max(...months.flatMap((month) => [month.rainMm, month.et0Mm]), 1)
  const width = 600
  const height = 150
  const slot = width / 12
  const y = (value) => height - (value / peak) * (height - 10)
  const halfEt0Path = months
    .map((month, index) => `${index === 0 ? 'M' : 'L'}${index * slot + slot / 2},${y(month.et0Mm / 2)}`)
    .join(' ')

  return (
    <figure className="season-chart">
      <svg aria-label="Average monthly rainfall compared with half of potential evapotranspiration" role="img" viewBox={`0 0 ${width} ${height + 18}`}>
        {months.map((month, index) => (
          <g key={month.month}>
            {isInSeason(index, season.rainySeasonStart, season.rainySeasonEnd) && (
              <rect className="season-band" height={height} width={slot} x={index * slot} y="0" />
            )}
            <rect
              className="rain-chart-bar"
              height={height - y(month.rainMm)}
              width={slot * 0.56}
              x={index * slot + slot * 0.22}
              y={y(month.rainMm)}
            >
              <title>{`${MONTHS[index]}: ${month.rainMm} mm rain, ${month.et0Mm} mm potential evapotranspiration`}</title>
            </rect>
            <text className="season-chart-label" textAnchor="middle" x={index * slot + slot / 2} y={height + 14}>
              {MONTHS[index][0]}
            </text>
          </g>
        ))}
        <path className="season-chart-line" d={halfEt0Path} />
        <line className="rain-chart-axis" x1="0" x2={width} y1={height - 0.5} y2={height - 0.5} />
      </svg>
      <figcaption className="season-legend">
        <span><i className="legend-swatch legend-swatch--bar" /> Usual rain each month</span>
        <span><i className="legend-swatch legend-swatch--line" /> Half of estimated water loss</span>
        <span><i className="legend-swatch legend-swatch--band" /> Rainy season</span>
      </figcaption>
    </figure>
  )
}

function GrowingSeason({ season }) {
  return (
    <section className="panel data-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">LONG-TERM WEATHER</span>
          <h2>Your growing season</h2>
        </div>
        <span className="live-label">NASA estimate</span>
      </div>
      <div className="stat-grid">
        <div className="stat-tile">
          <span className="stat-label">Rainy season</span>
          <strong className="stat-text">{monthDayLabel(season.rainySeasonStart)} – {monthDayLabel(season.rainySeasonEnd)}</strong>
          <span className="stat-note">{season.rainySeasonDays} days on average</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Growing time</span>
          <strong>{season.totalDays}<small> days</small></strong>
          <span className="stat-note">Includes days when soil may hold water after rain</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Rain during this season</span>
          <strong>{formatNumber(season.seasonRainfallMm, 0)}<small> mm</small></strong>
          <span className="stat-note">{formatNumber(season.annualRainfallMm, 0)} mm a year</span>
        </div>
      </div>
      <SeasonChart season={season} />
    </section>
  )
}

function SlotCard({ slot, kind }) {
  const empty = !slot.crop
  return (
    <article className={`panel slot-card slot-card--${kind}${empty ? ' slot-card--empty' : ''}`}>
      <div className="slot-header">
        <span className="eyebrow">{slot.label.toUpperCase()}</span>
        <span className="slot-months">{slot.months}</span>
      </div>
      <h3>
        {slot.crop ?? (slot.status === 'occupied' ? 'Still growing' : 'Fallow')}
      </h3>
      {!empty && (
        <div className="slot-tags">
          <span className={`role-tag role-tag--${slot.role}`}>{ROLE_LABELS[slot.role] ?? slot.role}</span>
          <span className="family-tag">{slot.family}</span>
        </div>
      )}
      <ul className="slot-reasons">
        {slot.reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
    </article>
  )
}

function Candidates({ candidates }) {
  return (
    <section className="panel data-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">RAIN-FED UPLAND CROPS</span>
          <h2>Other crops to consider</h2>
        </div>
      </div>
      <div className="table-scroll">
        <table className="data-table data-table--compact">
          <thead>
            <tr><th>Crop</th><th>Type</th><th>Suitability</th><th>Days to mature</th><th>Status</th></tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.crop}>
                <th scope="row">{candidate.crop}</th>
                <td>{ROLE_LABELS[candidate.role]}</td>
                <td>{candidate.suitabilityIndex === null ? '—' : `${Math.round(candidate.suitabilityIndex)}/100`}</td>
                <td>{candidate.growingDays[0]}–{candidate.growingDays[1]}</td>
                <td className="status-cell">
                  {candidate.included
                    ? (candidate.needsEarlyVariety ? 'Included: use an early variety' : 'Included')
                    : candidate.excludedBecause}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function RotationPlannerPage({ section, region, locationId, onLocationChange }) {
  const [years, setYears] = useState(3)
  const [irrigation, setIrrigation] = useState(false)
  const [previous, setPrevious] = useState('none')
  const [input, setInput] = useState('low')
  const location = region.data?.locations.find((candidate) => candidate.id === locationId)
  const result = useApiResource(
    (signal) => fetchGambiaRotation({ location: locationId, years, irrigation, previous, input }, { signal }),
    [locationId, years, irrigation, previous, input],
  )
  const data = result.data

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <div className="page-kicker"><span /> FARM PLANNING <span className="kicker-divider">/</span> THE GAMBIA</div>
          <h1>{section.label}</h1>
          <p>
            A crop plan for the next few years near {location ? `${location.name}, ${location.region}` : 'you'}.
          </p>
        </div>
        <div className="page-controls">
          <LocationSelect locations={region.data?.locations} onChange={onLocationChange} value={locationId} />
        </div>
      </div>

      <div className="planner-controls panel">
        <label className="location-select">
          <span>How many years?</span>
          <select onChange={(event) => setYears(Number(event.target.value))} value={years}>
            {[2, 3, 4, 5].map((count) => <option key={count} value={count}>{count} years</option>)}
          </select>
        </label>
        <label className="location-select">
          <span>Last rainy-season crop</span>
          <select onChange={(event) => setPrevious(event.target.value)} value={previous}>
            <option value="none">Not sure / new field</option>
            {PREVIOUS_CROPS.map((crop) => <option key={crop} value={crop}>{crop}</option>)}
          </select>
        </label>
        <div className="location-select">
          <span>Water for dry season?</span>
          <div className="segmented segmented--flush" role="group" aria-label="Dry-season irrigation">
            {[false, true].map((value) => (
              <button aria-pressed={irrigation === value} key={String(value)} onClick={() => setIrrigation(value)} type="button">
                {value ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>
        <div className="location-select">
          <span>Farm inputs</span>
          <div className="segmented segmented--flush" role="group" aria-label="Farming input level">
            {['low', 'high'].map((level) => (
              <button aria-pressed={input === level} key={level} onClick={() => setInput(level)} type="button">
                {level === 'low' ? 'Few inputs' : 'More inputs'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <LoadState loadingMessage="Building your rotation from NASA climate and FAO suitability data…" resource={result} />

      {result.status === 'success' && (
        <>
          {data.growingSeason?.months?.length > 0 && <GrowingSeason season={data.growingSeason} />}

          <section aria-labelledby="plan-title" className="source-category">
            <div className="section-heading">
              <div>
                <h2 id="plan-title">Your {data.summary.years}-year plan</h2>
                <p className="category-description">
                  {data.summary.legumeSeasons} seasons with soil-feeding crops
                  · {data.summary.families.length} crop famil{data.summary.families.length === 1 ? 'y' : 'ies'}
                  {data.request.previous ? ` · following ${data.request.previous}` : ''}
                </p>
              </div>
            </div>
            <ol className="rotation-timeline">
              {data.plan.map((entry) => (
                <li className="rotation-year" key={entry.year}>
                  <span className="rotation-year-label">{entry.year}</span>
                  <div className="rotation-slots">
                    <SlotCard kind="rainy" slot={entry.rainy} />
                    <SlotCard kind="dry" slot={entry.dry} />
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <Candidates candidates={data.candidates} />

          <section className="panel data-panel">
            <details className="card-notes">
              <summary>About this plan</summary>
              <ul>
                {data.notes.map((note) => <li key={note}>{note}</li>)}
                <li>Uses long-term NASA weather estimates and crop information. Local field conditions may differ.</li>
              </ul>
            </details>
          </section>
        </>
      )}
    </div>
  )
}

export default RotationPlannerPage
