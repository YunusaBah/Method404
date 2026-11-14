import { useState } from 'react'
import LoadState from './LoadState.jsx'
import LocationSelect from './LocationSelect.jsx'
import { formatDate, formatNumber, latest, sum } from './dataFormat.js'
import { useApiResource } from '../hooks/useApiResource.js'
import { fetchGambiaSourceData } from '../services/api.js'

const CATEGORIES = [
  { id: 'climate', title: 'Climate', description: 'Daily weather records for the location.' },
  { id: 'vegetation', title: 'Vegetation', description: 'How green the land is, from 16-day satellite composites.' },
  { id: 'terrain', title: 'Terrain', description: 'Height and slope, which affect drainage and erosion.' },
  { id: 'crops', title: 'Crop suitability', description: 'How well the climate and soils suit each crop, from a global model.' },
  { id: 'imagery', title: 'Satellite imagery', description: 'Recent field-scale scenes that cover the location.' },
  {
    id: 'earthdata',
    title: 'NASA Earthdata files',
    description: 'The latest NASA data files covering the location. Downloading them needs a free NASA Earthdata Login.',
  },
]

function ClimateSummary({ result }) {
  const rows = result.data.daily
  const isPower = result.source.id === 'power'
  const rain = isPower ? 'PRECTOTCORR' : 'precipitation_sum'
  const temp = isPower ? 'T2M_MAX' : 'temperature_2m_max'

  return (
    <dl className="value-list">
      <div><dt>Period</dt><dd>{formatDate(result.request.start)} – {formatDate(result.request.end)}</dd></div>
      <div><dt>Total rainfall</dt><dd>{formatNumber(sum(rows, rain))} mm</dd></div>
      <div><dt>Latest maximum temperature</dt><dd>{formatNumber(latest(rows, temp))} °C</dd></div>
      {isPower
        ? <div><dt>Latest root-zone wetness (0–1)</dt><dd>{formatNumber(latest(rows, 'GWETROOT'), 2)}</dd></div>
        : <div><dt>Latest topsoil moisture</dt><dd>{formatNumber(latest(rows, 'soil_moisture_0_to_7cm_mean'), 3)} m³/m³</dd></div>}
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

function EarthdataSummary({ result }) {
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
          {source.access === 'values' ? 'Values' : 'Catalogue'}
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
        loadingMessage={source.slow ? 'Loading. NASA’s vegetation service is slow, so this can take a few minutes the first time…' : 'Loading data…'}
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
            Every connected data source, read for {location ? `${location.name}, ${location.region}` : 'your location'}.
            “Values” sources return measurements or model output. “Catalogue” sources list the files or scenes that cover the location.
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
          <span className="eyebrow">NOT CONNECTED</span>
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
