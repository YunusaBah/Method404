const iconArtwork = {
  about: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5m0-8h.01" />
    </>
  ),
  arrowUpRight: (
    <>
      <path d="M7 17 17 7M8 7h9v9" />
    </>
  ),
  climate: (
    <>
      <path d="M12 3v2m0 14v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M3 12h2m14 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  data: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 4c-8 0-14 3-14 10a6 6 0 0 0 6 6c7 0 10-6 8-16Z" />
      <path d="M4 21c3-5 7-8 12-11" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  overview: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M5.64 9a7 7 0 0 1 11.6-2.6L20 12M4 12l2.76 5.6A7 7 0 0 0 18.36 15" />
    </>
  ),
  rotation: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M5.5 9A7 7 0 0 1 18 6l2 2m-16 8 2 2a7 7 0 0 0 12.5-3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 22v-9m0 0C8 13 5 10 5 6c4 0 7 3 7 7Zm0-3c0-4 3-7 7-7 0 4-3 7-7 7Z" />
      <path d="M8 22h8" />
    </>
  ),
  status: (
    <>
      <path d="M4 12a8 8 0 1 0 8-8 8.5 8.5 0 0 0-5.7 2.3L4 9" />
      <path d="M4 4v5h5m3-1v4l3 2" />
    </>
  ),
}

function Icon({ name, size = 20, strokeWidth = 1.8 }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      width={size}
    >
      {iconArtwork[name]}
    </svg>
  )
}

export default Icon
