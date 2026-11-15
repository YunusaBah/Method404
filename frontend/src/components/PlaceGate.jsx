import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { useAppData } from '../context/context'
import { LocationForm } from './LocationForm'

/** The current field, with a way back to the picker. */
export function PlaceBar() {
  const { place, t } = useAppData()
  if (!place) return null

  return (
    <p className="placebar">
      <MapPin size={15} strokeWidth={2.2} aria-hidden="true" />
      <span className="placebar__name">{place.name}</span>
      <Link className="placebar__change" to="/">
        {t('place.change')}
      </Link>
    </p>
  )
}

/** Renders the picker instead of the page when no field is chosen yet. */
export function PlaceGate({ children }) {
  const { place, choosePlace, t } = useAppData()

  if (place) return children

  return (
    <section className="gate">
      <h1 className="gate__title">{t('place.gate')}</h1>
      <p className="gate__sub">{t('place.gateSub')}</p>
      <LocationForm onPlace={choosePlace} />
    </section>
  )
}
