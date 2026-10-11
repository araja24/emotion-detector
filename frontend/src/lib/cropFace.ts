/** How much bigger than the dots the crop is, so the whole face (forehead, chin) fits. */
const PADDING = 1.15
/** Size of the picture we send — matches the default HSEmotion B0 model's 224x224 input. */
const CROP_SIZE = 224
const JPEG_QUALITY = 0.85

export type Box = { x: number; y: number; size: number }

/**
 * A square box (in video pixels) around the face dots, a bit bigger than the
 * face and always fully inside the frame. Dots come in as 0–1 fractions.
 */
export function faceBox(points: { x: number; y: number }[], videoWidth: number, videoHeight: number): Box {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const { x, y } of points) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  const width = (maxX - minX) * videoWidth
  const height = (maxY - minY) * videoHeight
  const centerX = ((minX + maxX) / 2) * videoWidth
  const centerY = ((minY + maxY) / 2) * videoHeight

  const size = Math.min(Math.max(width, height) * PADDING, videoWidth, videoHeight)
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max)
  return {
    x: clamp(centerX - size / 2, videoWidth - size),
    y: clamp(centerY - size / 2, videoHeight - size),
    size,
  }
}

let scratch: HTMLCanvasElement | null = null

/**
 * Copies just the face out of the current video frame into a small JPEG.
 *
 * Encodes with the synchronous toDataURL on purpose: Chrome schedules the
 * async encoders (toBlob, convertToBlob) for "idle time", and with the
 * face-dot loop busy every frame they wait out a ~1 s deadline, which would
 * cap us at one picture per second. A 224x224 JPEG encodes in about a millisecond.
 */
export function cropFace(video: HTMLVideoElement, box: Box): Promise<Blob> {
  if (!scratch) {
    scratch = document.createElement('canvas')
    scratch.width = CROP_SIZE
    scratch.height = CROP_SIZE
  }
  const ctx = scratch.getContext('2d')
  if (!ctx) return Promise.reject(new Error('2D canvas not available'))
  ctx.drawImage(video, box.x, box.y, box.size, box.size, 0, 0, CROP_SIZE, CROP_SIZE)

  const dataUrl = scratch.toDataURL('image/jpeg', JPEG_QUALITY)
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return Promise.resolve(new Blob([bytes], { type: 'image/jpeg' }))
}
