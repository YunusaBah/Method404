import Icon from './Icon.jsx'
import LoadState from './LoadState.jsx'
import { formatDate, formatNumber, latest, mean, sum } from './dataFormat.js'
import { useApiResource } from '../hooks/useApiResource.js'
import { fetchGambiaSourceData } from '../services/api.js'

function HealthCard({ health, onRetry }) {
  const isConnected = health.status === 'success'
  const title = {
    loading: 'Checking backend connection',
    success: 'Backend is reachable',
    error: 'Backend connection failed',
  }[health.status]

  return (
    <section aria-live="polite" className={`health-card health-card--${health.status}`}>
      <div className="health-card-icon">
        <Icon name={health.status === 'error' ? 'status' : 'overview'} size={19} />
      </div>
      <div className="health-card-copy">
        <span className="eyebrow">BACKEND API</span>
        <h3>{title}</h3>
        <p>
          {isConnected
            ? health.data.message
            : health.status === 'loading'
              ? 'Verifying the FarmShift API.'
              : health.error}
        </p>
      </div>
      {health.status === 'error' ? (
        <button className="text-button" onClick={onRetry} type="button">
          <Icon name="refresh" size={16} />
          Retry
        </button>
      ) : (
        <span className={`health-status health-status--${health.status}`}>
          <span className="connection-dot" />
          {health.status === 'success' ? 'Online' : 'Checking'}
        </span>
      )}
    </section>
  )
}

function DataSourceCard({ sources, onNavigate }) {
  const items = sources.data?.sources ?? []
  const withValues = items.filter((source) => source.access === 'values').length

  return (
    <section aria-labelledby="data-sources-title" className="panel source-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">DATA FOUNDATION</span>
          <h2 id="data-sources-title">Earth observation sources</h2>
        </div>
        {sources.status === 'success' && <span className="live-label">{items.length} connected</span>}
      </div>
      <p className="panel-description">
        {sources.status === 'success'
          ? `${withValues} sources return values for The Gambia. The rest list the satellite scenes and NASA files that cover each location.`
          : 'The data sources used for the environmental context layer.'}
      </p>
      <LoadState loadingMessage="Loading data sources…" resource={sources} />
      <ul className="source-list">
        {items.map((source) => (
          <li key={source.id}>
            <span className="source-icon"><Icon name="data" size={17} /></span>
            <span>{source.name}</span>
            <span className="source-state">{source.access === 'values' ? 'Values' : 'Catalogue'}</span>
          </li>
        ))}
      </ul>
      <button className="panel-link" onClick={() => onNavigate('environmental-data')} type="button">
        View all data <Icon name="arrowUpRight" size={16} />
      </button>
    </section>
  )
}

function ClimatePanel({ onNavigate, locationId, region }) {
  const power = useApiResource(
    (signal) => fetchGambiaSourceData('power', { location: locationId }, { signal }),
    [locationId],
  )
  const location = region.data?.locations.find((candidate) => candidate.id === locationId)
  const rows = power.data?.data.daily ?? []

  return (
    <section aria-labelledby="climate-panel-title" className="panel climate-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SEASONAL CONTEXT · {location ? location.name.toUpperCase() : 'THE GAMBIA'}</span>
          <h2 id="climate-panel-title">Climate signals, last 30 days</h2>
        </div>
        {power.status === 'success' && <span className="live-label">NASA POWER</span>}
      </div>
      <LoadState loadingMessage="Loading NASA POWER data…" resource={power} />
      {power.status === 'success' && (
        <>
          <div className="stat-grid">
            <div className="stat-tile">
              <span className="stat-label">Total rainfall</span>
              <strong>{formatNumber(sum(rows, 'PRECTOTCORR'))}<small> mm</small></strong>
            </div>
            <div className="stat-tile">
              <span className="stat-label">Mean temperature</span>
              <strong>{formatNumber(mean(rows, 'T2M'))}<small> °C</small></strong>
            </div>
            <div className="stat-tile">
              <span className="stat-label">Root-zone soil wetness</span>
              <strong>{formatNumber(latest(rows, 'GWETROOT'), 2)}</strong>
              <span className="stat-note">0 is dry, 1 is saturated</span>
            </div>
          </div>
          <p className="card-footnote">
            {formatDate(power.data.request.start)} to {formatDate(power.data.request.end)}. Modelled and satellite-derived estimates.
          </p>
        </>
      )}
      <button className="panel-link" onClick={() => onNavigate('climate')} type="button">
        Open climate insights <Icon name="arrowUpRight" size={16} />
      </button>
    </section>
  )
}

function PlanningCard({ icon, label, title, description, onClick, sectionId }) {
  return (
    <button className="planning-card" onClick={() => onClick(sectionId)} type="button">
      <span className="planning-card-icon"><Icon name={icon} size={20} /></span>
      <span className="planning-card-label">{label}</span>
      <strong>{title}</strong>
      <span className="planning-card-description">{description}</span>
      <span aria-hidden="true" className="planning-card-arrow">
        <Icon name="arrowUpRight" size={17} />
      </span>
    </button>
  )
}

function DashboardOverview({ health, onNavigate, locationId, region, sources }) {
  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <div className="page-kicker"><span /> FARM PLANNING <span className="kicker-divider">/</span> THE GAMBIA</div>
          <h1>A clearer view of your growing season.</h1>
          <p>Environmental context for more confident farm planning.</p>
        </div>
        <span className="page-date">Your regional workspace</span>
      </div>

      <section className="welcome-banner">
        <div className="welcome-art" aria-hidden="true">
          <span className="sun-disc" />
          <span className="field field--back" />
          <span className="field field--middle" />
          <span className="field field--front" />
          <span className="art-sprout art-sprout--one"><Icon name="sprout" size={46} strokeWidth={1.3} /></span>
          <span className="art-sprout art-sprout--two"><Icon name="sprout" size={34} strokeWidth={1.3} /></span>
        </div>
        <div className="welcome-content">
          <span className="welcome-label"><Icon name="leaf" size={15} /> DECISIONS ROOTED IN DATA</span>
          <h2>Plan with the season,<br />not guesswork.</h2>
          <p>
            FarmShift AI is building a practical view of environmental change
            to support crop planning across The Gambia.
          </p>
          <button className="welcome-button" onClick={() => onNavigate('climate')} type="button">
            Explore climate insights <Icon name="arrowUpRight" size={17} />
          </button>
        </div>
        <div className="welcome-region">
          <span className="region-dot" />
          <span>INITIAL REGION</span>
          <strong>The Gambia</strong>
        </div>
      </section>

      <HealthCard health={health} onRetry={health.retry} />

      <div className="dashboard-grid">
        <ClimatePanel locationId={locationId} onNavigate={onNavigate} region={region} />
        <DataSourceCard onNavigate={onNavigate} sources={sources} />
      </div>

      <section aria-labelledby="planning-title" className="planning-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR WORKSPACE</span>
            <h2 id="planning-title">Tools for better planning</h2>
          </div>
          <span className="section-note">Being prepared for future data integration</span>
        </div>
        <div className="planning-grid">
          <PlanningCard
            description="Compare NASA POWER and ERA5 rainfall, temperature and soil moisture."
            icon="climate"
            label="LIVE DATA"
            onClick={onNavigate}
            sectionId="climate"
            title="Climate insights"
          />
          <PlanningCard
            description="See which crops suit your area and whether it is time to sow."
            icon="sprout"
            label="LIVE DATA"
            onClick={onNavigate}
            sectionId="recommendations"
            title="Crop recommendations"
          />
          <PlanningCard
            description="Build a season-by-season plan with clear assumptions."
            icon="rotation"
            label="UNDER DEVELOPMENT"
            onClick={onNavigate}
            sectionId="rotation"
            title="Crop rotation planner"
          />
        </div>
      </section>
    </div>
  )
}

export default DashboardOverview
