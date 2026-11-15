import { AlertTriangle, Info } from 'lucide-react'

export function Notice({ tone = 'info', children }) {
  const Icon = tone === 'error' ? AlertTriangle : Info
  return (
    <p className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon size={18} strokeWidth={2} aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
