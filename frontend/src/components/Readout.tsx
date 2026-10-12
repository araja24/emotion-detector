import { EMOTIONS, EMOTION_INFO, type Emotion, type EmotionScores } from '../lib/emotions'
import { OFFLINE, type TrailEntry } from '../lib/trail'
import { LockIcon } from './icons'

type Props = {
  headline: { name: string; color: string; pct: string; voice: string }
  readsPerSecond: number
  scores: EmotionScores | null
  /** Bars in colour + highlighted top row only while actually reading. */
  reading: boolean
  /** Show numbers (vs "—") — false before the camera starts or with no face. */
  showNumbers: boolean
  top: Emotion | null
  trail: TrailEntry[]
}

/** The right-hand panel: the big "right now" reading, 8 bars, the 10-second history and the privacy note. */
export function Readout({ headline, readsPerSecond, scores, reading, showNumbers, top, trail }: Props) {
  return (
    <aside className="readout" aria-label="Emotion readout">
      <div>
        <div className="eyebrow">
          <span>Right now</span>
          <span>{readsPerSecond} reads / sec</span>
        </div>
        <div className="headline">
          <span className="headline__name" style={{ color: headline.color }}>
            {headline.name}
          </span>
          {headline.pct && <span className="headline__pct">{headline.pct}</span>}
        </div>
        <p className="voice">{headline.voice}</p>
      </div>

      <ul className="rows" aria-label="Confidence per emotion">
        {EMOTIONS.map((emotion) => {
          const { label, color } = EMOTION_INFO[emotion]
          const value = scores?.[emotion] ?? 0
          const percent = Math.round(value * 100)
          const isTop = reading && emotion === top
          return (
            <li key={emotion} className={`row${isTop ? ' row--top' : ''}`}>
              <span className="row__name">
                <span className="row__dot" style={{ background: color }} aria-hidden="true" />
                {label}
              </span>
              <span
                className="row__track"
                role="meter"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={showNumbers ? percent : 0}
              >
                <span
                  className="row__fill"
                  style={{ width: `${(value * 100).toFixed(1)}%`, background: reading ? color : '#4A505C' }}
                />
              </span>
              <span className="row__pct">{showNumbers ? `${percent}%` : '—'}</span>
            </li>
          )
        })}
      </ul>

      <div>
        <div className="eyebrow">
          <span>Last 10 seconds</span>
          <span>now</span>
        </div>
        <div className="trail" aria-hidden="true">
          {trail.map((entry, i) => {
            const isEmotion = entry.index >= 0
            return (
              <span
                key={i}
                className="trail__bar"
                style={{
                  height: isEmotion ? `${Math.round(30 + entry.confidence * 70)}%` : '18%',
                  background: isEmotion
                    ? EMOTION_INFO[EMOTIONS[entry.index]].color
                    : entry.index === OFFLINE
                      ? '#3A3F4B'
                      : '#22252D',
                }}
              />
            )
          })}
        </div>
      </div>

      <p className="readout__privacy">
        <LockIcon />
        <span>
          Your video stays in this browser. Only small face crops go to the server, are read in memory and never
          saved. Mien reads expressions, not feelings — it can be wrong.
        </span>
      </p>
    </aside>
  )
}
