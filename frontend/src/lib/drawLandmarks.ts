import { FaceLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'

type Connection = { start: number; end: number }

export type DrawOptions = {
  showDots: boolean
  showLines: boolean
}

const MESH_COLOR = 'rgba(34, 211, 238, 0.18)'
const CONTOUR_COLOR = 'rgba(34, 211, 238, 0.9)'
const DOT_COLOR = '#67e8f9'

/** The main face features we trace with bright lines. */
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

/**
 * Writes e.g. "😀 Happy 82%" just above the forehead. The canvas is mirrored
 * with CSS, so we mirror the text too — two flips make it readable again.
 */
export function drawEmotionLabel(ctx: CanvasRenderingContext2D, face: NormalizedLandmark[], text: string) {
  const { width, height } = ctx.canvas
  let minX = 1
  let maxX = 0
  let minY = 1
  for (const point of face) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
  }
  const fontSize = Math.round(Math.max(16, width / 40))
  const x = ((minX + maxX) / 2) * width
  const y = Math.max(minY * height - fontSize * 0.6, fontSize * 1.4)

  ctx.save()
  ctx.translate(x, y)
  ctx.scale(-1, 1)
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  const padX = fontSize * 0.5
  const boxWidth = ctx.measureText(text).width + padX * 2
  ctx.fillStyle = 'rgba(11, 15, 20, 0.75)'
  ctx.beginPath()
  ctx.roundRect(-boxWidth / 2, -fontSize * 1.35, boxWidth, fontSize * 1.5, fontSize * 0.4)
  ctx.fill()
  ctx.fillStyle = '#e6edf3'
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

/**
 * Paints one face onto the overlay canvas. Points arrive as 0–1 fractions of
 * the frame, so we multiply by the canvas size to get pixels.
 */
export function drawLandmarks(ctx: CanvasRenderingContext2D, face: NormalizedLandmark[], options: DrawOptions) {
  const { width, height } = ctx.canvas
  // Scale strokes with the video resolution so they look the same at 480p or 1080p.
  const unit = Math.max(1, width / 640)

  if (options.showLines) {
    ctx.lineWidth = unit * 0.6
    ctx.strokeStyle = MESH_COLOR
    strokeConnections(ctx, face, FaceLandmarker.FACE_LANDMARKS_TESSELATION, width, height)

    ctx.lineWidth = unit * 1.5
    ctx.strokeStyle = CONTOUR_COLOR
    ctx.shadowColor = CONTOUR_COLOR
    ctx.shadowBlur = unit * 6
    strokeConnections(ctx, face, CONTOURS, width, height)
    ctx.shadowBlur = 0
  }

  if (options.showDots) {
    const radius = unit * 1.3
    ctx.fillStyle = DOT_COLOR
    ctx.beginPath()
    for (const point of face) {
      const x = point.x * width
      const y = point.y * height
      ctx.moveTo(x + radius, y)
      ctx.arc(x, y, radius, 0, Math.PI * 2)
    }
    ctx.fill()
  }
}
