import { CloudRain, Droplets, Layers } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n'
import { setWater } from '../state/store'
import { TopBar } from '../components/TopBar'

const OPTIONS = [
  { id: 'rainfed', icon: <CloudRain size={32} strokeWidth={2} /> },
  { id: 'lowland', icon: <Layers size={32} strokeWidth={2} /> },
  { id: 'irrigated', icon: <Droplets size={32} strokeWidth={2} /> },
]

export function WaterScreen() {
  const { t } = useT()
  const navigate = useNavigate()

  function choose(water) {
    setWater(water)
    navigate('/')
  }

  return (
    <main className="screen">
      <TopBar
        audioKeys={['water.title', 'water.rainfed', 'water.lowland', 'water.irrigated']}
        onBack={() => navigate(-1)}
        title={t('water.title')}
      />
      <h1 className="screen__title">{t('water.title')}</h1>

      <ul className="list">
        {OPTIONS.map((option) => (
          <li key={option.id}>
            <button className="list__row" onClick={() => choose(option.id)} type="button">
              {option.icon}
              <strong>{t(`water.${option.id}`)}</strong>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
