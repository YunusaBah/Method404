import Icon from './Icon.jsx'

const dataSources = ['NASA POWER', 'NASA SMAP', 'NASA GPM', 'NASA MODIS']

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
              ? 'Verifying the FarmShift service at localhost:5000.'
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

function DataSourceCard() {
  return (
    <section aria-labelledby="data-sources-title" className="panel source-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">DATA FOUNDATION</span>
          <h2 id="data-sources-title">Earth observation sources</h2>
        </div>
        <span className="planned-label">Planned</span>
      </div>
      <p className="panel-description">
        These NASA datasets are candidates for the environmental context layer.
        No observations are connected yet.
      </p>
      <ul className="source-list">
        {dataSources.map((source) => (
          <li key={source}>
            <span className="source-icon"><Icon name="data" size={17} /></span>
            <span>{source}</span>
            <span className="source-state">Not connected</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ClimatePanel({ onNavigate }) {
  return (
    <section aria-labelledby="climate-panel-title" className="panel climate-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SEASONAL CONTEXT</span>
          <h2 id="climate-panel-title">Climate signals</h2>
        </div>
        <span className="unavailable-label">Awaiting data</span>
      </div>
      <div className="empty-data-state">
        <span className="empty-data-icon"><Icon name="climate" size={23} /></span>
        <h3>No climate data connected</h3>
        <p>
          Climate indicators will appear here after a verified data source is
          integrated. We do not display sample values as observations.
        </p>
      </div>
      <button className="panel-link" onClick={() => onNavigate('environmental-data')} type="button">
        Explore data sources <Icon name="arrowUpRight" size={16} />
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

function DashboardOverview({ health, onNavigate }) {
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
        <ClimatePanel onNavigate={onNavigate} />
        <DataSourceCard />
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
            description="See how environmental patterns can inform decisions."
            icon="climate"
            label="UNDER DEVELOPMENT"
            onClick={onNavigate}
            sectionId="climate"
            title="Climate insights"
          />
          <PlanningCard
            description="Compare options when regional data and guidance are ready."
            icon="sprout"
            label="UNDER DEVELOPMENT"
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
