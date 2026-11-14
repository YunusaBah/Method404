export function Stepper({
  format,
  label,
  max,
  maxLabel,
  min,
  minLabel,
  onChange,
  step,
  value,
}) {
  const ticks = []
  for (let tick = min; tick <= max; tick += step) ticks.push(tick)

  return (
    <div className="stepper">
      <div className="stepper__head">
        <span className="stepper__label">{label}</span>
        <span className="stepper__value">{format(value)}</span>
      </div>
      <div className="stepper__control">
        <span aria-hidden="true" className="stepper__ticks">
          {ticks.map((tick) => (
            <span className="stepper__tick" key={tick} />
          ))}
        </span>
        <input
          aria-label={label}
          className="stepper__range"
          max={max}
          min={min}
          onChange={(event) => onChange(Number(event.target.value))}
          step={step}
          type="range"
          value={value}
        />
      </div>
      <div className="stepper__ends">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  )
}
