import { EMOTIONS, type Emotion, type EmotionScores } from './emotions'

/**
 * How quickly the bars follow a new answer: after this many ms they've moved
 * ~63% of the way, after ~2.3x this ~90%. Based on elapsed *time*, not on the
 * number of answers, so a slow server (few answers per second) doesn't make
 * the bars lag — they just take bigger steps.
 */
export const SMOOTHING_TIME_MS = 250

/**
 * Time-based exponential moving average:
 *   amount = 1 - e^(-elapsed / SMOOTHING_TIME_MS)
 *   shown  = (1 - amount) * old + amount * new
 * Stops the bars twitching every time you blink.
 */
export function smoothScores(
  previous: EmotionScores | null,
  next: EmotionScores,
  elapsedMs: number,
  timeConstantMs = SMOOTHING_TIME_MS,
): EmotionScores {
  if (!previous) return { ...next }
  const amount = 1 - Math.exp(-Math.max(elapsedMs, 0) / timeConstantMs)
  const smoothed = {} as EmotionScores
  for (const emotion of EMOTIONS) {
    smoothed[emotion] = (1 - amount) * previous[emotion] + amount * next[emotion]
  }
  return smoothed
}

export function topEmotion(scores: EmotionScores): Emotion {
  return EMOTIONS.reduce((best, emotion) => (scores[emotion] > scores[best] ? emotion : best))
}
