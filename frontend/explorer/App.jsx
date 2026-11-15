import { useState } from 'react'
import ClimatePage from './components/ClimatePage.jsx'
import CropRecommendationsPage from './components/CropRecommendationsPage.jsx'
import EnvironmentalDataPage from './components/EnvironmentalDataPage.jsx'
import RotationPlannerPage from './components/RotationPlannerPage.jsx'
import SectionPage from './components/SectionPage.jsx'
import Topbar from './components/Topbar.jsx'
import { sections } from './components/navigationSections.js'
import { useApiResource } from './hooks/useApiResource.js'
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
  const [activeSection, setActiveSection] = useState('climate')
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
  function navigateToSection(sectionId) {
    setActiveSection(sectionId)
  }

  const pageProps = {
    section: currentSection,
    region,
    sources,
    locationId,
    onLocationChange: changeLocation,
    onNavigate: navigateToSection,
  }

  return (
    <div className="app-shell">
      <div className="main-column">
        <Topbar
          activeSection={activeSection}
          onNavigate={navigateToSection}
        />
        <main className="main-content" id="main-content">
          {activeSection === 'climate' && <ClimatePage {...pageProps} />}
          {activeSection === 'environmental-data' && <EnvironmentalDataPage {...pageProps} />}
          {activeSection === 'recommendations' && <CropRecommendationsPage {...pageProps} />}
          {activeSection === 'rotation' && <RotationPlannerPage {...pageProps} />}
          {!['climate', 'environmental-data', 'recommendations', 'rotation'].includes(activeSection) && (
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
