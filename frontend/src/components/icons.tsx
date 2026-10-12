/** Stroke icons from the Mien design mockup. All decorative: the text next to them carries the meaning. */

export function LogoMark({ color }: { color: string }) {
  return (
    <svg className="logo__mark" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true" style={{ color }}>
      <circle cx="17" cy="17" r="15" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="12" cy="14" r="2" fill="currentColor" />
      <circle cx="22" cy="14" r="2" fill="currentColor" />
      <path d="M11 21c3.5 3 8.5 3 12 0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function CameraIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  )
}

export function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" {...stroke} style={{ flex: 'none' }}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

export function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5v15l13-7.5z" />
    </svg>
  )
}

export function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="4.5" width="4" height="15" rx="1" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" />
    </svg>
  )
}

export function ChevronDownIcon() {
  return (
    <svg className="select__chevron" viewBox="0 0 24 24" aria-hidden="true" {...stroke} strokeWidth={2.5}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function RetryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  )
}

export function UnlinkIcon() {
  return (
    <svg className="offline__icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 0 1 4 8" />
      <line x1="8" y1="12" x2="12" y2="12" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}

export function SearchFaceIcon() {
  return (
    <svg className="notice__icon" width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M4 16V10a6 6 0 0 1 6-6h6M40 4h6a6 6 0 0 1 6 6v6M52 40v6a6 6 0 0 1-6 6h-6M16 52h-6a6 6 0 0 1-6-6v-6" />
      <ellipse cx="28" cy="28" rx="11" ry="14" strokeDasharray="0.1 5.5" />
    </svg>
  )
}

export function DottedFace({ color, opacity }: { color: string; opacity: number }) {
  return (
    <svg className="empty__face" width="112" height="140" viewBox="0 0 112 140" aria-hidden="true" style={{ color, opacity }}>
      <ellipse cx="56" cy="70" rx="48" ry="62" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="0.1 9" />
      <circle cx="38" cy="58" r="4" fill="currentColor" />
      <circle cx="74" cy="58" r="4" fill="currentColor" />
      <path d="M36 90c12 10 28 10 40 0" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="0.1 8" />
    </svg>
  )
}
