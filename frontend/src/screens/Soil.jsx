import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n'
import { setSoil } from '../state/store'
import { SoilDiagram } from '../components/SoilDiagram'
import { TopBar } from '../components/TopBar'

const SOILS = [
  { id: 'sandy', variant: 'sandy' },
  { id: 'loam', variant: 'loam' },
  { id: 'clay', variant: 'clay' },
  { id: 'unknown', variant: 'unknown' },
]

export function SoilScreen() {
  const { t } = useT()
  const navigate = useNavigate()

  function choose(soil) {
    setSoil(soil, false)
    window.setTimeout(() => navigate('/'), 200)
  }

  return (
    <main className="screen">
      <TopBar
        audioKeys={['soil.title', 'soil.sandy', 'soil.loam', 'soil.clay', 'soil.unknown']}
        onBack={() => navigate(-1)}
        title={t('soil.title')}
      />
      <h1 className="screen__title">{t('soil.title')}</h1>

      <ul className="list">
        {SOILS.map((soil) => (
          <li key={soil.id}>
            <button className="list__row" onClick={() => choose(soil.id)} type="button">
              <SoilDiagram variant={soil.variant} />
              <strong>{t(`soil.${soil.id}`)}</strong>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
