import { useEffect } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AppDataProvider } from './context/AppData'
import { useAppData } from './context/context'
import { Header } from './components/Header'
import { Nav } from './components/Nav'
import { Home } from './routes/Home'
import { Weather } from './routes/Weather'
import { Crops } from './routes/Crops'
import { Calendar } from './routes/Calendar'
import { Rotation } from './routes/Rotation'

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

function Footer() {
  const { t } = useAppData()

  return (
    <footer className="footer">
      <p>{t('footer.note')}</p>
      <p>{t('footer.team')}</p>
    </footer>
  )
}

export default function App() {
  return (
    <AppDataProvider>
      <HashRouter>
        <ScrollToTop />
        <div className="shell">
          <div className="wrap">
            <Header />
            <Nav />
            <main className="main">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/weather" element={<Weather />} />
                <Route path="/crops" element={<Crops />} />
                <Route path="/plan" element={<Calendar />} />
                <Route path="/rotation" element={<Rotation />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </div>
      </HashRouter>
    </AppDataProvider>
  )
}
