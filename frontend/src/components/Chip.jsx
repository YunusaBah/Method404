export function Chip({ icon, label, onClick, value }) {
  return (
    <button className="chip" onClick={onClick} type="button">
      <span className="chip__label">
        {icon}
        {label}
      </span>
      <span className="chip__value">{value}</span>
    </button>
  )
}
