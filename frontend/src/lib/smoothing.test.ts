import { describe, expect, it } from 'vitest'
import { SMOOTHING_TIME_MS, smoothScores, topEmotion } from './smoothing'

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
    expect(smoothScores(null, scores(0.8, 0.2), 100)).toEqual(scores(0.8, 0.2))
  })

  it('moves 1 - 1/e (~63%) of the way after one time constant', () => {
    const next = smoothScores(scores(1, 0), scores(0, 1), SMOOTHING_TIME_MS)
    expect(next.neutral).toBeCloseTo(1 - Math.exp(-1))
  })

  it('catches up ~90% within about half a second', () => {
    const next = smoothScores(scores(1, 0), scores(0, 1), 600)
    expect(next.neutral).toBeGreaterThan(0.9)
  })

  it('depends on elapsed time, not on how many answers arrived', () => {
    // 2 answers 250 ms apart (slow server) vs 8 answers 62.5 ms apart (fast server):
    // after the same 500 ms, the bars must be in the same place.
    let slow = scores(1, 0)
    for (let i = 0; i < 2; i++) slow = smoothScores(slow, scores(0, 1), 250)
    let fast = scores(1, 0)
    for (let i = 0; i < 8; i++) fast = smoothScores(fast, scores(0, 1), 62.5)
    expect(slow.neutral).toBeCloseTo(fast.neutral, 10)
  })

  it('jumps straight to the new answer after a long gap (e.g. resuming from pause)', () => {
    expect(smoothScores(scores(1, 0), scores(0, 1), 10_000).neutral).toBeCloseTo(1, 5)
  })

  it('does not move when no time has passed', () => {
    expect(smoothScores(scores(1, 0), scores(0, 1), 0)).toEqual(scores(1, 0))
  })
})

describe('topEmotion', () => {
  it('picks the biggest score', () => {
    expect(topEmotion(scores(0.6, 0.4))).toBe('happiness')
    expect(topEmotion(scores(0.1, 0.9))).toBe('neutral')
  })
})
