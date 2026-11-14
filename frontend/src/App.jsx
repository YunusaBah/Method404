import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { LANGUAGES } from './i18n'
import { LocationScreen } from './screens/Location'
import { PlanScreen } from './screens/Plan'
import { PrioritiesScreen } from './screens/Priorities'
import { SoilScreen } from './screens/Soil'
import { WaterScreen } from './screens/Water'
import { useAppState } from './state/store'

function SetupRoute() {
  const { step } = useParams()
  const { profile } = useAppState()

  if (step === 'location') return <LocationScreen />
  if (!profile) return <Navigate replace to="/setup/location" />
  if (step === 'soil') return <SoilScreen />
  if (step === 'water') return <WaterScreen />
  if (step === 'priorities') return <PrioritiesScreen />
  return <Navigate replace to="/" />
}

export default function App() {
  const { hydrated, language, profile } = useAppState()

  useEffect(() => {
    const entry = LANGUAGES.find((item) => item.id === language)
    document.documentElement.lang = entry?.htmlLang ?? 'en'
  }, [language])

  if (!hydrated) return null

  return (
    <HashRouter>
      <Routes>
        <Route
          element={profile ? <PlanScreen /> : <Navigate replace to="/setup/location" />}
          path="/"
        />
        <Route element={<SetupRoute />} path="/setup/:step" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </HashRouter>
  )
}
