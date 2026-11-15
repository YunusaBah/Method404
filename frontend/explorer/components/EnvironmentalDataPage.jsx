import { useState } from 'react'
import LoadState from './LoadState.jsx'
import LocationSelect from './LocationSelect.jsx'
import { formatDate, formatNumber, latest, sum } from './dataFormat.js'
import { useApiResource } from '../hooks/useApiResource.js'
import { fetchGambiaSourceData } from '../services/api.js'

const CATEGORIES = [
  { id: 'climate', title: 'Weather', description: 'Rain, temperature and air moisture for this area.' },
  { id: 'vegetation', title: 'Green land', description: 'Satellite pictures that show how green the land is.' },
  { id: 'terrain', title: 'Land shape', description: 'Land height and slope, which can affect water flow.' },
  { id: 'crops', title: 'Crop fit', description: 'A guide to crops that may suit this area.' },
  { id: 'imagery', title: 'Satellite pictures', description: 'Recent satellite views of this area.' },
  {
    id: 'earthdata',
    title: 'NASA satellite data',
    description: 'Soil water and land information from NASA satellites.',
  },
]

function ClimateSummary({ result }) {
  const rows = result.data.daily
  const isPower = result.source.id === 'power'
  const rain = isPower ? 'PRECTOTCORR' : 'precipitation_sum'
  const temp = isPower ? 'T2M_MAX' : 'temperature_2m_max'
  const soilWater = latest(rows, 'soil_moisture_0_to_7cm_mean')

  return (
    <dl className="value-list">
      <div><dt>Dates</dt><dd>{formatDate(result.request.start)} – {formatDate(result.request.end)}</dd></div>
      <div><dt>Rain in this period</dt><dd>{formatNumber(sum(rows, rain))} mm</dd></div>
      <div><dt>Hottest recent day</dt><dd>{formatNumber(latest(rows, temp))} °C</dd></div>
      {isPower
        ? <div><dt>Air moisture</dt><dd>{formatNumber(latest(rows, 'RH2M'))} %</dd></div>
        : <div><dt>Soil water near the surface</dt><dd>{formatNumber(soilWater === null ? null : soilWater * 100, 0)}%</dd></div>}
    </dl>
  )
}

function VegetationSummary({ result }) {
  const { composites, availableRange } = result.data

  return (
    <>
      <ul className="ndvi-list">
        {composites.map((composite) => (
          <li key={composite.date}>
            <span>{formatDate(composite.date)}</span>
            <span className="ndvi-track" aria-hidden="true">
              {composite.ndvi !== null && (
                <span className="ndvi-fill" style={{ width: `${Math.max(0, composite.ndvi) * 100}%` }} />
              )}
            </span>
            <strong>{composite.ndvi === null ? 'No data' : formatNumber(composite.ndvi, 2)}</strong>
          </li>
        ))}
      </ul>
      {availableRange && (
        <p className="card-footnote">Record available {formatDate(availableRange.first)} to {formatDate(availableRange.last)}.</p>
      )}
    </>
  )
}

function TerrainSummary({ result }) {
  return (
    <dl className="value-list">
      <div><dt>Elevation</dt><dd>{formatNumber(result.data.elevationMetres, 0)} m above sea level</dd></div>
      <div><dt>Slope</dt><dd>{formatNumber(result.data.slopeDegrees, 1)}° across about {result.data.windowMetres} m</dd></div>
    </dl>
  )
}

function CropSummary({ result }) {
  return (
    <table className="data-table data-table--compact">
      <thead>
        <tr><th>Crop</th><th>Index (0–100)</th><th>Class</th></tr>
      </thead>
      <tbody>
        {result.data.crops.map((crop) => (
          <tr key={crop.crop}>
            <th scope="row">{crop.crop}</th>
            <td>
              <span className="index-cell">
                <span className="ndvi-track" aria-hidden="true">
                  <span className="ndvi-fill" style={{ width: `${crop.suitabilityIndex ?? 0}%` }} />
                </span>
                {formatNumber(crop.suitabilityIndex, 0)}
              </span>
            </td>
            <td>{crop.suitabilityClass ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SceneThumbnail({ src, alt }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <span className="scene-thumb scene-thumb--empty">No preview</span>
  return <img alt={alt} className="scene-thumb" loading="lazy" onError={() => setFailed(true)} src={src} />
}

function ImagerySummary({ result }) {
  const { scenes } = result.data
  if (!scenes.length) {
    return <p className="load-state">No scenes under {result.request.maxCloud}% cloud cover in this period.</p>
  }

  return (
    <ul className="scene-list">
      {scenes.map((scene) => (
        <li key={scene.id}>
          <SceneThumbnail alt={`Preview of ${scene.id}`} src={scene.thumbnail} />
          <div>
            <strong>{formatDate(scene.datetime)}</strong>
            <span>{formatNumber(scene.cloudCover, 0)}% cloud · {scene.platform ?? 'Unknown platform'}</span>
            {scene.metadata && <a href={scene.metadata} rel="noreferrer" target="_blank">Scene details</a>}
          </div>
        </li>
      ))}
    </ul>
  )
}

function formatTime(value) {
  if (!value) return '—'
  if (value.length === 10) return formatDate(value)
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
  })
}

function EarthdataValues({ result }) {
  const { fields, series, gridCell } = result.data
  const timeKey = 'date' in (series[0] ?? {}) ? 'date' : 'time'
  const rows = [...series].reverse()
  const withData = series.filter((row) => fields.some((field) => row[field.key] !== null)).length

  if (!series.length) return <p className="load-state">No readings were found for this period.</p>

  return (
    <>
      <p className="card-footnote">
        {withData} of {series.length} {timeKey === 'date' ? 'days' : 'time steps'} have readings
        · {gridCell.resolution}
      </p>
      <div className="table-scroll table-scroll--short">
        <table className="data-table data-table--compact">
          <thead>
            <tr>
              <th>{timeKey === 'date' ? 'Date' : 'Time'}</th>
              {fields.map((field) => <th key={field.key}>{field.label} ({field.unit})</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[timeKey]}>
                <th scope="row">{formatTime(row[timeKey])}</th>
                {fields.map((field) => (
                  <td key={field.key}>{formatNumber(row[field.key], field.digits)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function EarthdataSummary({ result }) {
  if (result.data.series) return <EarthdataValues result={result} />
  const { granules } = result.data
  if (!granules.length) return <p className="load-state">No files cover this location yet.</p>

  return (
    <ul className="granule-list">
      {granules.slice(0, 5).map((granule) => (
        <li key={granule.id}>
          <span className="granule-date">{formatDate(granule.start)}</span>
          <span className="granule-name" title={granule.id}>{granule.id}</span>
          {granule.downloadUrl && (
            <a href={granule.downloadUrl} rel="noreferrer" target="_blank">
              Download{granule.sizeMB ? ` · ${formatNumber(granule.sizeMB, 0)} MB` : ''}
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}

const SUMMARIES = {
  climate: ClimateSummary,
  vegetation: VegetationSummary,
  terrain: TerrainSummary,
  crops: CropSummary,
  imagery: ImagerySummary,
  earthdata: EarthdataSummary,
}

function SourceCard({ source, locationId }) {
  const [input, setInput] = useState('low')
  const params = { location: locationId, ...(source.id === 'gaez' ? { input } : {}) }
  const resource = useApiResource(
    (signal) => fetchGambiaSourceData(source.id, params, { signal, slow: source.slow }),
    [source.id, locationId, input],
  )
  const Summary = SUMMARIES[source.category]

  return (
    <article className="panel source-card">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{source.provider}</span>
          <h3>{source.name}</h3>
        </div>
        <span className={source.access === 'values' ? 'live-label' : 'planned-label'}>
          {source.access === 'values' ? 'Data' : 'Files'}
        </span>
      </div>
      <p className="panel-description">{source.measures}.</p>

      {source.id === 'gaez' && (
        <div className="segmented" role="group" aria-label="Farming input level">
          {['low', 'high'].map((level) => (
            <button
              aria-pressed={input === level}
              key={level}
              onClick={() => setInput(level)}
              type="button"
            >
              {level === 'low' ? 'Low input' : 'High input'}
            </button>
          ))}
        </div>
      )}

      <LoadState
        loadingMessage={source.slow ? 'Loading satellite data. This may take a little while…' : 'Loading data…'}
        resource={resource}
      />
      {resource.status === 'success' && <Summary result={resource.data} />}
      {resource.status === 'success' && resource.data.notes?.length > 0 && (
        <details className="card-notes">
          <summary>About this data</summary>
          <ul>{resource.data.notes.map((note) => <li key={note}>{note}</li>)}</ul>
        </details>
      )}
      <a className="panel-link" href={source.link} rel="noreferrer" target="_blank">Source website ↗</a>
    </article>
  )
}

function EnvironmentalDataPage({ section, region, sources, locationId, onLocationChange }) {
  const location = region.data?.locations.find((candidate) => candidate.id === locationId)

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <div className="page-kicker"><span /> FARM PLANNING <span className="kicker-divider">/</span> THE GAMBIA</div>
          <h1>{section.label}</h1>
          <p>
            Weather and land information for {location ? `${location.name}, ${location.region}` : 'your area'}.
            These are estimates and satellite records, not readings from your field.
          </p>
        </div>
        <div className="page-controls">
          <LocationSelect locations={region.data?.locations} onChange={onLocationChange} value={locationId} />
        </div>
      </div>

      <LoadState resource={sources} loadingMessage="Loading the list of data sources…" />

      {sources.status === 'success' && CATEGORIES.map((category) => {
        const items = sources.data.sources.filter((source) => source.category === category.id)
        if (!items.length) return null
        return (
          <section aria-labelledby={`category-${category.id}`} className="source-category" key={category.id}>
            <div className="section-heading">
              <div>
                <h2 id={`category-${category.id}`}>{category.title}</h2>
                <p className="category-description">{category.description}</p>
              </div>
            </div>
            <div className="source-grid">
              {items.map((source) => <SourceCard key={source.id} locationId={locationId} source={source} />)}
            </div>
          </section>
        )
      })}

      {sources.status === 'success' && sources.data.notConnected.length > 0 && (
        <section className="panel">
          <span className="eyebrow">NOT AVAILABLE YET</span>
          <ul className="note-list">
            {sources.data.notConnected.map((item) => (
              <li key={item.name}><strong>{item.name}.</strong> {item.reason}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export default EnvironmentalDataPage
