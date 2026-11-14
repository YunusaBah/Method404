// PLACEHOLDER: replace with commissioned hand-squeeze diagrams
export function SoilDiagram({ variant }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={64}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 64 64"
      width={64}
    >
      <path d="M8 38c0 11 9 18 22 18s22-7 22-18" />
      <path d="M14 38h34" />
      {variant === 'sandy' ? (
        <>
          <path d="M22 38c0-7 4-12 9-12s9 5 9 12" />
          <circle cx="20" cy="30" r="1.5" />
          <circle cx="27" cy="24" r="1.5" />
          <circle cx="38" cy="24" r="1.5" />
          <circle cx="45" cy="30" r="1.5" />
          <circle cx="31" cy="50" r="1.5" />
          <circle cx="40" cy="48" r="1.5" />
        </>
      ) : null}
      {variant === 'loam' ? (
        <>
          <path d="M20 38c0-9 5-15 12-15s12 6 12 15" />
          <path d="M24 32c2-2 4-3 6-3M34 29c2 0 4 1 5 3" />
          <circle cx="30" cy="46" r="1.5" />
          <circle cx="38" cy="45" r="1.5" />
        </>
      ) : null}
      {variant === 'clay' ? (
        <>
          <path d="M19 38c0-10 5-16 13-16s13 6 13 16" />
          <path d="M24 38c0-7 3-11 8-11s8 4 8 11" />
          <path d="M27 33h10" />
        </>
      ) : null}
      {variant === 'unknown' ? (
        <>
          <path d="M25 31a7 7 0 0 1 14 0c0 4-5 5-5 8" />
          <path d="M34 43h.01" />
          <path d="M20 38h24" />
        </>
      ) : null}
    </svg>
  )
}
