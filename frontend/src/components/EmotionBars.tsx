import { EMOTIONS, EMOTION_INFO, type Emotion, type EmotionScores } from '../lib/emotions'

type Props = {
  scores: EmotionScores | null
  top: Emotion | null
}

/**
 * One bar per feeling. Rows stay in a fixed order (rather than re-sorting
 * biggest-first) so they don't jump around every time two values swap.
 */
export function EmotionBars({ scores, top }: Props) {
  return (
    <ul className="bars" aria-label="Emotion confidence">
      {EMOTIONS.map((emotion) => {
        const { label, emoji, color } = EMOTION_INFO[emotion]
        const percent = scores ? Math.round(scores[emotion] * 100) : 0
        const isTop = emotion === top
        return (
          <li key={emotion} className={isTop ? 'bar bar--top' : 'bar'}>
            <span className="bar__emoji" aria-hidden="true">
              {emoji}
            </span>
            <span className="bar__label">{label}</span>
            <span
              className="bar__track"
              role="meter"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <span className="bar__fill" style={{ width: `${percent}%`, background: color }} />
            </span>
            <span className="bar__value">{percent}%</span>
          </li>
        )
      })}
    </ul>
  )
}
