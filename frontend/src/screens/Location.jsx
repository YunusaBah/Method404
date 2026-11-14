import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { engine } from '../engine'
import { useT } from '../i18n'
import { setLocation } from '../state/store'
import { LanguageRow } from '../components/LanguageRow'
import { TopBar } from '../components/TopBar'

export function LocationScreen() {
  const { t } = useT()
  const navigate = useNavigate()
  const [showList, setShowList] = useState(false)
  const [error, setError] = useState(false)
  const districts = engine.districts()

  function apply(district, cellId) {
    setLocation(district.id, cellId, district.defaultSoil)
    if (district.defaultSoil) {
      navigate('/')
    } else {
      navigate('/setup/soil')
    }
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setError(true)
      setShowList(true)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const cell = engine.nearestCell(position.coords.latitude, position.coords.longitude)
        const district = cell
          ? districts.find((entry) => entry.id === cell.districtId)
          : undefined
        if (!cell || !district) {
          setError(true)
          setShowList(true)
          return
        }
        apply(district, cell.cellId)
      },
      () => {
        setError(true)
        setShowList(true)
      },
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 8000 },
    )
  }

  return (
    <main className="screen">
      <TopBar audioKeys={['location.use', 'location.choose']} title={t('app.name')} />
      <LanguageRow />
      <h1 className="screen__title">{t('location.title')}</h1>

      <div className="actions">
        <button className="button button--primary" onClick={useMyLocation} type="button">
          {t('location.use')}
        </button>
        <button
          className="button button--outline"
          onClick={() => setShowList(true)}
          type="button"
        >
          {t('location.choose')}
        </button>
      </div>

      {showList ? (
        <section aria-labelledby="district-list-title">
          <h2 className="section-title" id="district-list-title">
            {t('location.choose')}
          </h2>
          {error ? <p role="alert">{t('location.denied')}</p> : null}
          <ul className="list">
            {districts.map((district) => (
              <li key={district.id}>
                <button
                  className="list__row"
                  onClick={() => apply(district, district.id)}
                  type="button"
                >
                  <strong>{district.name}</strong>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
