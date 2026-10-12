import { FaceLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'

type Connection = { start: number; end: number }

export type DrawOptions = {
  showDots: boolean
  /** The mesh: faint tessellation plus the bright feature contours. */
  showMesh: boolean
  /** Mood colour for the contours and feature dots. */
  accent: string
}

const MESH_COLOR = 'rgba(255, 255, 255, 0.15)'
const DOT_COLOR = 'rgba(255, 255, 255, 0.7)'

/** The main face features we trace in the mood colour. */
const CONTOURS: Connection[] = [
  ...FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
  ...FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
  ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
  ...FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
  ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
  ...FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
  ...FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
  ...FaceLandmarker.FACE_LANDMARKS_LIPS,
]
const CONTOUR_POINTS = [...new Set(CONTOURS.flatMap(({ start, end }) => [start, end]))]

function strokeConnections(
  ctx: CanvasRenderingContext2D,
  face: NormalizedLandmark[],
  connections: Connection[],
  width: number,
  height: number,
) {
  ctx.beginPath()
  for (const { start, end } of connections) {
    const a = face[start]
    const b = face[end]
    if (!a || !b) continue
    ctx.moveTo(a.x * width, a.y * height)
    ctx.lineTo(b.x * width, b.y * height)
  }
  ctx.stroke()
}

function fillDots(
  ctx: CanvasRenderingContext2D,
  face: NormalizedLandmark[],
  indexes: Iterable<number>,
  radius: number,
  width: number,
  height: number,
) {
  ctx.beginPath()
  for (const index of indexes) {
    const point = face[index]
    if (!point) continue
    const x = point.x * width
    const y = point.y * height
    ctx.moveTo(x + radius, y)
    ctx.arc(x, y, radius, 0, Math.PI * 2)
  }
  ctx.fill()
}

/**
 * Paints one face onto the overlay canvas. Points arrive as 0–1 fractions of
 * the frame, so we multiply by the canvas size to get pixels.
 */
export function drawLandmarks(ctx: CanvasRenderingContext2D, face: NormalizedLandmark[], options: DrawOptions) {
  const { width, height } = ctx.canvas
  // Scale strokes with the video resolution so they look the same at 480p or 1080p.
  const unit = Math.max(1, width / 640)

  if (options.showMesh) {
    ctx.lineWidth = unit * 0.5
    ctx.strokeStyle = MESH_COLOR
    strokeConnections(ctx, face, FaceLandmarker.FACE_LANDMARKS_TESSELATION, width, height)

    ctx.lineWidth = unit * 1.3
    ctx.lineJoin = 'round'
    ctx.strokeStyle = options.accent
    ctx.globalAlpha = 0.9
    strokeConnections(ctx, face, CONTOURS, width, height)
    ctx.globalAlpha = 1
  }

  if (options.showDots) {
    ctx.fillStyle = DOT_COLOR
    fillDots(ctx, face, face.keys(), unit * 1.05, width, height)
    ctx.fillStyle = options.accent
    fillDots(ctx, face, CONTOUR_POINTS, unit * 1.5, width, height)
  }
}
