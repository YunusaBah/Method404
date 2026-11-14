import { Droplets, Layers, List, Lock, Plus, Sun } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n'
import { setPriorities, useAppState } from '../state/store'
import { TopBar } from '../components/TopBar'

const OPTIONS = [
  { id: 'water', icon: <Droplets size={28} strokeWidth={2} /> },
  { id: 'soil', icon: <Layers size={28} strokeWidth={2} /> },
  { id: 'income', icon: <Plus size={28} strokeWidth={2} /> },
  { id: 'food', icon: <Sun size={28} strokeWidth={2} /> },
  { id: 'labor', icon: <List size={28} strokeWidth={2} /> },
  { id: 'risk', icon: <Lock size={28} strokeWidth={2} /> },
]

export function PrioritiesScreen() {
  const { t } = useT()
  const navigate = useNavigate()
  const { profile } = useAppState()
  const [selected, setSelected] = useState(profile?.priorities ?? [])

  function toggle(criterion) {
    setSelected((current) => {
      if (current.includes(criterion)) {
        return current.filter((entry) => entry !== criterion)
      }
      if (current.length >= 3) return current
      return [...current, criterion]
    })
  }

  function done() {
    setPriorities(selected)
    navigate('/')
  }

  return (
    <main className="screen">
      <TopBar
        audioKeys={['priorities.title', ...OPTIONS.map((option) => `priority.${option.id}`)]}
        onBack={() => navigate(-1)}
        title={t('priorities.title')}
      />
      <h1 className="screen__title">{t('priorities.title')}</h1>

      <div className="priority-grid">
        {OPTIONS.map((option) => {
          const index = selected.indexOf(option.id)
          const isSelected = index >= 0
          return (
            <button
              aria-pressed={isSelected}
              className={`priority${isSelected ? ' is-selected' : ''}`}
              key={option.id}
              onClick={() => toggle(option.id)}
              type="button"
            >
              {option.icon}
              <span className="priority__label">{t(`priority.${option.id}`)}</span>
              {isSelected ? <span className="priority__badge">{index + 1}</span> : null}
            </button>
          )
        })}
      </div>

      <button
        className="button button--primary"
        disabled={selected.length < 1 || selected.length > 3}
        onClick={done}
        type="button"
      >
        {t('common.done')}
      </button>
    </main>
  )
}
