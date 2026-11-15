import { useId, useState } from 'react'

function LocationSelect({ locations, value, onChange }) {
  const listId = useId()
  const selectedLocation = locations?.find((location) => location.id === value)
  const [query, setQuery] = useState(null)

  if (!locations?.length) return null

  return (
    <label className="location-select">
      <span>Search for a town or area</span>
      <input
        autoComplete="off"
        list={listId}
        onChange={(event) => {
          const nextQuery = event.target.value
          setQuery(nextQuery)
          const match = locations.find(
            (location) => `${location.name} · ${location.region}`.toLowerCase() === nextQuery.trim().toLowerCase(),
          )
          if (match) onChange(match.id)
        }}
        placeholder="Type a town name"
        value={query ?? (selectedLocation ? `${selectedLocation.name} · ${selectedLocation.region}` : '')}
      />
      <datalist id={listId}>
        {locations.map((location) => (
          <option key={location.id} value={`${location.name} · ${location.region}`} />
        ))}
      </datalist>
    </label>
  )
}

export default LocationSelect
