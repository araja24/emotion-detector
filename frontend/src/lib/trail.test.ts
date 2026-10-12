import { describe, expect, it } from 'vitest'
import { OFFLINE, NO_READING, TRAIL_LENGTH, emptyTrail, pushTrail, trailEntry } from './trail'

const scores = {
  neutral: 0.1,
  happiness: 0.8,
  surprise: 0.04,
  sadness: 0.02,
  anger: 0.01,
  disgust: 0.01,
  fear: 0.01,
  contempt: 0.01,
}

describe('trailEntry', () => {
  it('records the leading emotion and its confidence while reading', () => {
    expect(trailEntry({ reading: true, backendOpen: true, scores })).toEqual({ index: 1, confidence: 0.8 })
  })

  it('records "offline" when the backend is unreachable', () => {
    expect(trailEntry({ reading: false, backendOpen: false, scores })).toEqual({ index: OFFLINE, confidence: 0 })
  })

  it('records "no reading" when there is no face or no answer yet', () => {
    expect(trailEntry({ reading: false, backendOpen: true, scores })).toEqual({ index: NO_READING, confidence: 0 })
    expect(trailEntry({ reading: true, backendOpen: true, scores: null })).toEqual({ index: NO_READING, confidence: 0 })
  })
})

describe('pushTrail', () => {
  it('keeps a fixed length, dropping the oldest', () => {
    let trail = emptyTrail()
    expect(trail).toHaveLength(TRAIL_LENGTH)
    trail = pushTrail(trail, { index: 3, confidence: 0.5 })
    expect(trail).toHaveLength(TRAIL_LENGTH)
    expect(trail.at(-1)).toEqual({ index: 3, confidence: 0.5 })
    expect(trail[0]).toEqual({ index: NO_READING, confidence: 0 })
  })
})
