function LocationSelect({ locations, value, onChange }) {
  if (!locations?.length) return null

  return (
    <label className="location-select">
      <span>Location</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name} · {location.region}
          </option>
        ))}
      </select>
    </label>
  )
}

export default LocationSelect
