import { LogoMark } from './icons'

export type Tone = 'ok' | 'warn' | 'bad' | 'idle'
export type Pill = { label: string; tone: Tone }

type Props = { accent: string; pills: Pill[] }

/** Wordmark on the left, camera / face / backend status pills on the right. */
export function Header({ accent, pills }: Props) {
  return (
    <header className="header">
      <div className="logo">
        <LogoMark color={accent} />
        <span className="logo__word">Emotion Detector</span>
        <span className="logo__tag">reads your face, live</span>
      </div>
      <ul className="pills" aria-label="Status">
        {pills.map((pill) => (
          <li key={pill.label} className={`pill pill--${pill.tone}`}>
            <span className="pill__dot" aria-hidden="true" />
            {pill.label}
          </li>
        ))}
      </ul>
    </header>
  )
}
