import Icon from './Icon.jsx'

function Topbar({ health, onMenuClick, section }) {
  const healthLabel = {
    loading: 'Connecting to API',
    success: 'API connected',
    error: 'API unavailable',
  }[health.status]

  return (
    <header className="topbar">
      <button
        aria-label="Open navigation menu"
        className="mobile-menu-button"
        onClick={onMenuClick}
        type="button"
      >
        <Icon name="menu" size={21} />
      </button>
      <div className="breadcrumbs">
        <span>FarmShift AI</span>
        <span aria-hidden="true" className="breadcrumb-divider">/</span>
        <strong>{section?.label ?? 'Overview'}</strong>
      </div>
      <div className="topbar-actions">
        <div className="topbar-region">
          <span className="region-dot" />
          The Gambia
        </div>
        <div
          aria-live="polite"
          className={`connection-indicator connection-indicator--${health.status}`}
          role="status"
        >
          <span className="connection-dot" />
          <span>{healthLabel}</span>
        </div>
      </div>
    </header>
  )
}

export default Topbar
