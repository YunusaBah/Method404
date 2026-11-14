import { useState } from 'react'
import LoadState from './LoadState.jsx'
import LocationSelect from './LocationSelect.jsx'
import { formatDate, formatNumber } from './dataFormat.js'
import { useApiResource } from '../hooks/useApiResource.js'
import { fetchGambiaRecommendations } from '../services/api.js'

const GROUPS = [
  { id: 'plant-now', title: 'Plant now', description: 'In the sowing window and the rains have started.' },
  { id: 'plant-now-irrigated', title: 'Plant now with irrigation', description: 'Dry-season crops that need a water source.' },
  { id: 'wait-for-rains', title: 'Ready once the rains start', description: 'The sowing window is open, but the rains have not properly started.' },
  { id: 'next-season', title: 'Plan for the next season', description: 'Outside the sowing window. Ranked by long-term suitability.' },
  { id: 'not-suitable', title: 'Not recommended here', description: 'Long-term suitability is very low for rain-fed farming at this location.' },
]

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function ConditionTile({ label, value, unit, note }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <strong>{value}{unit && <small>{unit}</small>}</strong>
      {note && <span className="stat-note">{note}</span>}
    </div>
  )
}

function Conditions({ result }) {
  const { season, conditions } = result
  const { rainfall, rainOnset, soilMoisture, waterBalance } = conditions

  return (
    <section className="panel data-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">CURRENT CONDITIONS</span>
          <h2>{season.monthName}: {season.current === 'rainy' ? 'rainy season' : 'dry season'}</h2>
        </div>
        <span className="live-label">Live data</span>
      </div>
      <p className="panel-description panel-description--wide">{season.description}</p>
      <div className="stat-grid">
        <ConditionTile
          label="Rain in the last 30 days"
          note={rainfall ? `${rainfall.rainyDays} rainy days · ${rainfall.source}` : 'No rainfall data'}
          unit=" mm"
          value={formatNumber(rainfall?.totalMm)}
        />
        {season.current === 'rainy' && (
          <ConditionTile
            label="Rains started?"
            note={rainOnset?.onset ? `${rainOnset.onset.rainMm} mm from ${formatDate(rainOnset.onset.date)}` : '20 mm within 3 days needed'}
            value={rainOnset?.started ? 'Yes' : rainOnset?.onset ? 'False start' : 'Not yet'}
          />
        )}
        <ConditionTile
          label="Soil moisture"
          note={soilMoisture ? `${soilMoisture.status} · ${soilMoisture.source}, ${formatDate(soilMoisture.date)}` : 'No soil data'}
          unit={soilMoisture ? ` ${soilMoisture.unit}` : ''}
          value={formatNumber(soilMoisture?.value, 2)}
        />
        <ConditionTile
          label="Rain vs crop water demand"
          note={waterBalance
            ? `${formatNumber(waterBalance.rainfallMm, 0)} mm rain vs ${formatNumber(waterBalance.referenceEvapotranspirationMm, 0)} mm ET₀ · ERA5`
            : 'No ERA5 data'}
          unit="%"
          value={waterBalance?.percentOfDemandMet ?? '—'}
        />
      </div>
    </section>
  )
}

function SowingCalendar({ months, current }) {
  return (
    <div className="sowing-calendar" aria-label={`Sowing months: ${months.map((m) => MONTH_ABBREVIATIONS[m - 1]).join(', ')}`}>
      {MONTH_ABBREVIATIONS.map((name, index) => (
        <span
          className={[
            'sowing-month',
            months.includes(index + 1) ? 'sowing-month--on' : '',
            current === index + 1 ? 'sowing-month--current' : '',
          ].join(' ')}
          key={name}
          title={name}
        >
          {name[0]}
        </span>
      ))}
    </div>
  )
}

function CropCard({ crop, month }) {
  return (
    <article className="panel crop-card">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            {crop.system === 'irrigated' ? 'IRRIGATED' : crop.system === 'lowland' ? 'LOWLAND' : 'RAIN-FED'}
          </span>
          <h3>{crop.crop}</h3>
        </div>
        <span className="crop-score" title="FAO GAEZ rain-fed suitability index (0–100)">
          {crop.suitabilityIndex === null ? '—' : Math.round(crop.suitabilityIndex)}
          <small>/100</small>
        </span>
      </div>
      <span className="ndvi-track crop-track" aria-hidden="true">
        <span className="ndvi-fill" style={{ width: `${crop.suitabilityIndex ?? 0}%` }} />
      </span>
      <p className="crop-class">
        {crop.system === 'irrigated'
          ? `Rain-fed: ${(crop.suitabilityClass ?? 'not rated').toLowerCase()}. With irrigation it can do much better.`
          : `${crop.suitabilityClass ?? 'No suitability data'} long-term suitability`}
      </p>
      <SowingCalendar current={month} months={crop.sowingMonths} />
      <p className="crop-tip">{crop.tip}</p>
      <details className="card-notes">
        <summary>Why this recommendation</summary>
        <ul>{crop.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      </details>
    </article>
  )
}

function CropRecommendationsPage({ section, region, locationId, onLocationChange }) {
  const [input, setInput] = useState('low')
  const location = region.data?.locations.find((candidate) => candidate.id === locationId)
  const result = useApiResource(
    (signal) => fetchGambiaRecommendations({ location: locationId, input }, { signal }),
    [locationId, input],
  )
  const data = result.data

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <div className="page-kicker"><span /> FARM PLANNING <span className="kicker-divider">/</span> THE GAMBIA</div>
          <h1>{section.label}</h1>
          <p>
            Which crops suit {location ? `${location.name}, ${location.region}` : 'your location'}, and whether now is
            the time to sow, from long-term suitability and this season’s rain and soil moisture.
          </p>
        </div>
        <div className="page-controls">
          <LocationSelect locations={region.data?.locations} onChange={onLocationChange} value={locationId} />
          <div className="location-select">
            <span>Farming inputs</span>
            <div className="segmented segmented--flush" role="group" aria-label="Farming input level">
              {['low', 'high'].map((level) => (
                <button aria-pressed={input === level} key={level} onClick={() => setInput(level)} type="button">
                  {level === 'low' ? 'Traditional' : 'Improved'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <LoadState loadingMessage="Combining suitability, rainfall and soil moisture data…" resource={result} />

      {result.status === 'success' && (
        <>
          <Conditions result={data} />

          {GROUPS.map((group) => {
            const crops = data.crops.filter((crop) => crop.group === group.id)
            if (!crops.length) return null
            return (
              <section aria-labelledby={`group-${group.id}`} className="source-category" key={group.id}>
                <div className="section-heading">
                  <div>
                    <h2 id={`group-${group.id}`}>{group.title} <span className="group-count">{crops.length}</span></h2>
                    <p className="category-description">{group.description}</p>
                  </div>
                </div>
                <div className="crop-grid">
                  {crops.map((crop) => <CropCard crop={crop} key={crop.crop} month={data.season.month} />)}
                </div>
              </section>
            )
          })}

          <section className="panel data-panel">
            <span className="eyebrow">HOW THIS WORKS</span>
            <ul className="note-list">
              {data.notes.map((note) => <li key={note}>{note}</li>)}
              <li>
                Data used:{' '}
                {data.sources.map((source) => `${source.name} (${source.status === 'ok' ? 'ok' : 'unavailable'})`).join(', ')}.
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

export default CropRecommendationsPage
