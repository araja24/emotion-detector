import { describe, expect, it } from 'vitest'
import { smoothScores, topEmotion } from './smoothing'

const scores = (happiness: number, neutral: number) => ({
  neutral,
  happiness,
  surprise: 0,
  sadness: 0,
  anger: 0,
  disgust: 0,
  fear: 0,
  contempt: 0,
})

describe('smoothScores', () => {
  it('uses the first answer as-is', () => {
    expect(smoothScores(null, scores(0.8, 0.2))).toEqual(scores(0.8, 0.2))
  })

  it('mixes 70% old with 30% new', () => {
    const next = smoothScores(scores(1, 0), scores(0, 1))
    expect(next.happiness).toBeCloseTo(0.7)
    expect(next.neutral).toBeCloseTo(0.3)
  })

  it('glides toward a steady new value', () => {
    let shown = scores(1, 0)
    for (let i = 0; i < 20; i++) shown = smoothScores(shown, scores(0, 1))
    expect(shown.neutral).toBeGreaterThan(0.99)
  })

  it('accepts a custom amount of smoothing', () => {
    expect(smoothScores(scores(1, 0), scores(0, 1), 1).neutral).toBe(1)
  })
})

describe('topEmotion', () => {
  it('picks the biggest score', () => {
    expect(topEmotion(scores(0.6, 0.4))).toBe('happiness')
    expect(topEmotion(scores(0.1, 0.9))).toBe('neutral')
  })
})
