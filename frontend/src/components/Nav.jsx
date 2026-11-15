import { CalendarDays, CloudSun, Home, RefreshCw, Sprout } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAppData } from '../context/context'

const ITEMS = [
  { to: '/', key: 'nav.home', icon: Home, end: true },
  { to: '/weather', key: 'nav.weather', icon: CloudSun },
  { to: '/crops', key: 'nav.crops', icon: Sprout },
  { to: '/plan', key: 'nav.plan', icon: CalendarDays },
  { to: '/rotation', key: 'nav.rotation', icon: RefreshCw },
]

export function Nav() {
  const { t } = useAppData()

  return (
    <nav className="tabs" aria-label={t('nav.label')}>
      {ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="tab">
          <item.icon size={21} strokeWidth={2} aria-hidden="true" />
          <span className="tab__label">{t(item.key)}</span>
        </NavLink>
      ))}
    </nav>
  )
}
