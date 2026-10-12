import { EMOTIONS, type EmotionScores } from './emotions'
import { topEmotion } from './smoothing'

/** "Last 10 seconds": one sample every 250 ms. */
export const TRAIL_LENGTH = 40
export const TRAIL_INTERVAL_MS = 250

/** Special indexes for samples that aren't an emotion. */
export const NO_READING = -1
export const OFFLINE = -2

export type TrailEntry = { index: number; confidence: number }

export function emptyTrail(): TrailEntry[] {
  return Array.from({ length: TRAIL_LENGTH }, () => ({ index: NO_READING, confidence: 0 }))
}

export function trailEntry(state: { reading: boolean; backendOpen: boolean; scores: EmotionScores | null }): TrailEntry {
  if (!state.backendOpen) return { index: OFFLINE, confidence: 0 }
  if (!state.reading || !state.scores) return { index: NO_READING, confidence: 0 }
  const top = topEmotion(state.scores)
  return { index: EMOTIONS.indexOf(top), confidence: state.scores[top] }
}

export function pushTrail(trail: TrailEntry[], entry: TrailEntry): TrailEntry[] {
  return [...trail.slice(1 - TRAIL_LENGTH), entry]
}
