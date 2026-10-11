export type Tone ='good' | 'wait' | 'bad' | 'off'

type Props = { label: string; value: string; tone: Tone }

/** A small coloured pill, e.g. "Backend · connected". */
export function StatusBadge({ label, value, tone }: Props) {
  return (
    <span className={`badge badge--${tone}`}>
      <span className="badge__dot" aria-hidden="true" />
      {label} · {value}
    </span>
  )
}
