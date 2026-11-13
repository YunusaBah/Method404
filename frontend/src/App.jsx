import { useState } from 'react'
import DashboardOverview from './components/DashboardOverview.jsx'
import SectionPage from './components/SectionPage.jsx'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import { sections } from './components/navigationSections.js'
import { useBackendHealth } from './hooks/useBackendHealth.js'
import './App.css'

function App() {
  const [activeSection, setActiveSection] = useState('overview')
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const health = useBackendHealth()
  const currentSection = sections.find((section) => section.id === activeSection)

  function navigateToSection(sectionId) {
    setActiveSection(sectionId)
    setMobileNavigationOpen(false)
  }

  return (
    <div className="app-shell">
      {mobileNavigationOpen && (
        <button
          aria-label="Close navigation menu"
          className="navigation-backdrop"
          onClick={() => setMobileNavigationOpen(false)}
          type="button"
        />
      )}
      <Sidebar
        activeSection={activeSection}
        isMobileOpen={mobileNavigationOpen}
        onNavigate={navigateToSection}
      />
      <div className="main-column">
        <Topbar
          health={health}
          onMenuClick={() => setMobileNavigationOpen(true)}
          section={currentSection}
        />
        <main className="main-content" id="main-content">
          {activeSection === 'overview' ? (
            <DashboardOverview health={health} onNavigate={navigateToSection} />
          ) : (
            <SectionPage section={currentSection} />
          )}
          <footer className="page-footer">
            <span>FarmShift AI</span>
            <span>Decision support, grounded in environmental data.</span>
          </footer>
        </main>
      </div>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
    </div>
  )
}

export default App
