import { useState } from 'react'
import ClimatePage from './components/ClimatePage.jsx'
import CropRecommendationsPage from './components/CropRecommendationsPage.jsx'
import DashboardOverview from './components/DashboardOverview.jsx'
import EnvironmentalDataPage from './components/EnvironmentalDataPage.jsx'
import RotationPlannerPage from './components/RotationPlannerPage.jsx'
import SectionPage from './components/SectionPage.jsx'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import { sections } from './components/navigationSections.js'
import { useApiResource } from './hooks/useApiResource.js'
import { useBackendHealth } from './hooks/useBackendHealth.js'
import { fetchGambiaRegion, fetchGambiaSources } from './services/api.js'
import './App.css'
import './DataPages.css'

const LOCATION_STORAGE_KEY = 'farmshift.location'

function readStoredLocation() {
  try {
    return window.localStorage.getItem(LOCATION_STORAGE_KEY)
  } catch {
    return null
  }
}

function App() {
  const [activeSection, setActiveSection] = useState('overview')
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const health = useBackendHealth()
  const region = useApiResource((signal) => fetchGambiaRegion({ signal }), [])
  const sources = useApiResource((signal) => fetchGambiaSources({ signal }), [])
  const [storedLocation, setStoredLocation] = useState(readStoredLocation)
  const knownLocations = region.data?.locations ?? []
  const locationId = knownLocations.some((location) => location.id === storedLocation)
    ? storedLocation
    : region.data?.defaultLocation ?? 'janjanbureh'

  function changeLocation(nextLocationId) {
    setStoredLocation(nextLocationId)
    try {
      window.localStorage.setItem(LOCATION_STORAGE_KEY, nextLocationId)
    } catch {
      // Storage can be unavailable (for example in private browsing); the choice still applies.
    }
  }

  const currentSection = sections.find((section) => section.id === activeSection)
  const pageProps = { section: currentSection, region, sources, locationId, onLocationChange: changeLocation }

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
          {activeSection === 'overview' && (
            <DashboardOverview health={health} onNavigate={navigateToSection} {...pageProps} />
          )}
          {activeSection === 'climate' && <ClimatePage {...pageProps} />}
          {activeSection === 'environmental-data' && <EnvironmentalDataPage {...pageProps} />}
          {activeSection === 'recommendations' && <CropRecommendationsPage {...pageProps} />}
          {activeSection === 'rotation' && <RotationPlannerPage {...pageProps} />}
          {!['overview', 'climate', 'environmental-data', 'recommendations', 'rotation'].includes(activeSection) && (
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
