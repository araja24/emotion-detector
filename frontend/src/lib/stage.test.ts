import { describe, expect, it } from 'vitest'
import { faceAnchor, withAlpha } from './stage'

const pt = (x: number, y: number) => ({ x, y })

describe('faceAnchor', () => {
  // A 1280x720 video shown in a 400x300 (4:3) stage with object-fit: cover:
  // scale = max(400/1280, 300/720) = 0.4167 -> drawn 533x300, 66.7 px cropped off each side.
  const video = { width: 1280, height: 720 }
  const stage = { width: 400, height: 300 }

  it('mirrors x (the video is shown like a mirror) and accounts for the cover crop', () => {
    // Face on the LEFT of the camera image (x 0.3..0.5) appears on the RIGHT of the mirrored stage.
    const a = faceAnchor([pt(0.3, 0.2), pt(0.5, 0.6)], video, stage, 'center')
    const scale = 300 / 720
    const offsetX = (400 - 1280 * scale) / 2
    expect(a.x).toBeCloseTo(offsetX + (1 - 0.4) * 1280 * scale)
    expect(a.y).toBeCloseTo(0.2 * 720 * scale)
    expect(a.faceWidth).toBeCloseTo(0.2 * 1280 * scale)
  })

  it("'side' sits to the right of the face centre, 'center' right above it", () => {
    const face = [pt(0.4, 0.3), pt(0.6, 0.7)]
    const center = faceAnchor(face, video, stage, 'center')
    const side = faceAnchor(face, video, stage, 'side')
    expect(side.x).toBeGreaterThan(center.x)
    expect(side.y).toBe(center.y)
  })

  it('works when the stage is taller than the video (crop top/bottom)', () => {
    const tall = { width: 300, height: 400 }
    const a = faceAnchor([pt(0.5, 0.5), pt(0.5, 0.5)], video, tall, 'center')
    expect(a.x).toBeCloseTo(150)
    expect(a.y).toBeCloseTo(200)
  })
})

describe('withAlpha', () => {
  it('adds a 2-digit alpha to a #RRGGBB colour', () => {
    expect(withAlpha('#FFC94D', 0.35)).toBe('#FFC94D59')
    expect(withAlpha('#FFC94D', 0)).toBe('#FFC94D00')
    expect(withAlpha('#FFC94D', 1)).toBe('#FFC94DFF')
  })
})
