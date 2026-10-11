import { EMOTIONS, type Emotion, type EmotionScores } from './emotions'

/**
 * Exponential moving average: shown = (1 - amount) * old + amount * new.
 * Stops the bars twitching every time you blink; 0.3 means "30% new answer".
 */
export function smoothScores(previous: EmotionScores | null, next: EmotionScores, amount = 0.3): EmotionScores {
  if (!previous) return { ...next }
  const smoothed = {} as EmotionScores
  for (const emotion of EMOTIONS) {
    smoothed[emotion] = (1 - amount) * previous[emotion] + amount * next[emotion]
  }
  return smoothed
}

export function topEmotion(scores: EmotionScores): Emotion {
  return EMOTIONS.reduce((best, emotion) => (scores[emotion] > scores[best] ? emotion : best))
}
