import { describe, expect, it } from 'vitest'
import { faceBox } from './cropFace'

const pt = (x: number, y: number) => ({ x, y })

describe('faceBox', () => {
  it('makes a square around the dots, 15% bigger, centred on the face', () => {
    // A 200x100 px face in the middle of a 1000x1000 frame.
    const box = faceBox([pt(0.4, 0.45), pt(0.6, 0.55)], 1000, 1000)
    expect(box.size).toBeCloseTo(230) // longest side 200 * 1.15
    expect(box.x + box.size / 2).toBeCloseTo(500)
    expect(box.y + box.size / 2).toBeCloseTo(500)
  })

  it('works in pixels of a non-square video', () => {
    const box = faceBox([pt(0.25, 0.25), pt(0.75, 0.75)], 1280, 720)
    // 640 x 360 px face -> 736 would not fit in 720 tall, so it's capped at 720.
    expect(box.size).toBe(720)
    expect(box.y).toBe(0)
    expect(box.x + box.size / 2).toBeCloseTo(640)
  })

  it('slides the box back inside the frame when the face is at an edge', () => {
    const box = faceBox([pt(0, 0), pt(0.1, 0.1)], 1000, 1000)
    expect(box.x).toBe(0)
    expect(box.y).toBe(0)
    const right = faceBox([pt(0.95, 0.9), pt(1.05, 1.0)], 1000, 1000)
    expect(right.x + right.size).toBeLessThanOrEqual(1000)
    expect(right.y + right.size).toBeLessThanOrEqual(1000)
  })
})
