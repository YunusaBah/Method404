import Icon from './Icon.jsx'
import { sections } from './navigationSections.js'

function Topbar({ activeSection, onNavigate }) {
  return (
    <header className="topbar">
      <a aria-label="FarmShift AI home" className="brand topbar-brand" href="#main-content" onClick={() => onNavigate('climate')}>
        <span aria-hidden="true" className="brand-mark">
          <Icon name="leaf" size={21} strokeWidth={2} />
        </span>
        <span className="brand-copy">
          <strong>FarmShift <span>AI</span></strong>
          <small>METHOD404</small>
        </span>
      </a>

      <nav aria-label="Main navigation" className="topbar-nav">
        {sections.map((section) => (
          <button
            aria-current={activeSection === section.id ? 'page' : undefined}
            className={`topbar-nav-item${activeSection === section.id ? ' topbar-nav-item--active' : ''}`}
            key={section.id}
            onClick={() => onNavigate(section.id)}
            type="button"
          >
            <Icon name={section.icon} size={17} />
            <span>{section.label}</span>
          </button>
        ))}
      </nav>

      <a className="topbar-farm-link" href="./">
        <Icon name="sprout" size={17} />
        <span>My farm plan</span>
      </a>
    </header>
  )
}

export default Topbar
