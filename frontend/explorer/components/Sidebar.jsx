import Icon from './Icon.jsx'
import { sections } from './navigationSections.js'

function Sidebar({ activeSection, isMobileOpen, onNavigate }) {
  return (
    <aside
      aria-label="Main navigation"
      className={`sidebar${isMobileOpen ? ' sidebar--open' : ''}`}
    >
      <a
        aria-label="FarmShift AI home"
        className="brand"
        href="#main-content"
        onClick={() => onNavigate('overview')}
      >
        <span aria-hidden="true" className="brand-mark">
          <Icon name="leaf" size={23} strokeWidth={2} />
        </span>
        <span className="brand-copy">
          <strong>FarmShift <span>AI</span></strong>
          <small>METHOD404</small>
        </span>
      </a>

      <div className="workspace-label">WORKSPACE</div>
      <nav aria-label="Dashboard sections" className="sidebar-nav">
        {sections.map((section) => (
          <button
            aria-current={activeSection === section.id ? 'page' : undefined}
            className={`nav-item${activeSection === section.id ? ' nav-item--active' : ''}`}
            key={section.id}
            onClick={() => onNavigate(section.id)}
            type="button"
          >
            <Icon name={section.icon} size={19} />
            <span>{section.label}</span>
            {activeSection === section.id && <span className="nav-indicator" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <a className="nav-item farm-app-link" href="./">
          <Icon name="sprout" size={18} />
          <span>Back to my farm plan</span>
        </a>
        <div className="region-card">
          <span className="region-card-icon"><Icon name="leaf" size={17} /></span>
          <div>
            <span className="region-card-label">INITIAL REGION</span>
            <strong>The Gambia</strong>
          </div>
          <span aria-label="Current region" className="region-dot" />
        </div>
        <div className="team-signature">
          <span className="team-avatar">M</span>
          <span><strong>METHOD404</strong><small>NASA Space Apps project</small></span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
