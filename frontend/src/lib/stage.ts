type Size = { width: number; height: number }

export type Anchor = { x: number; y: number; faceWidth: number }

/**
 * Where the floating emotion label should point, in stage pixels.
 *
 * The video is drawn with `object-fit: cover` (scaled up and cropped to fill
 * the stage) and mirrored, so a landmark's 0–1 position has to go through the
 * same scale, crop and flip to land on the face you see.
 *   'side'   → just right of the face centre, at the top of the head (desktop)
 *   'center' → straight above the head (narrow screens)
 */
export function faceAnchor(
  points: { x: number; y: number }[],
  video: Size,
  stage: Size,
  mode: 'side' | 'center',
): Anchor {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  for (const { x, y } of points) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
  }
  const scale = Math.max(stage.width / video.width, stage.height / video.height)
  const offsetX = (stage.width - video.width * scale) / 2
  const offsetY = (stage.height - video.height * scale) / 2
  const centerX = offsetX + (1 - (minX + maxX) / 2) * video.width * scale
  const faceWidth = (maxX - minX) * video.width * scale
  return {
    x: mode === 'side' ? centerX + faceWidth * 0.18 : centerX,
    y: offsetY + minY * video.height * scale,
    faceWidth,
  }
}

/** '#RRGGBB' + opacity → '#RRGGBBAA' (for borders and glows tinted by the mood colour). */
export function withAlpha(hex: string, opacity: number): string {
  const alpha = Math.round(Math.min(Math.max(opacity, 0), 1) * 255)
  return hex + alpha.toString(16).padStart(2, '0').toUpperCase()
}
