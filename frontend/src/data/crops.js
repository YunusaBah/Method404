// Photographs are static, committed WebP files produced by `npm run images`.
// They are never served through Express: the CDN and the service worker can
// cache them, and the app works offline on the very first visit.

const base = import.meta.env.BASE_URL

export function cropPhoto(id) {
  return `${base}crops/${id}.webp`
}

export function cropThumb(id) {
  return `${base}crops/${id}-sm.webp`
}
