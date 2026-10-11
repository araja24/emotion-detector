import type { RefObject } from 'react'
import type { CameraStatus } from '../hooks/useCamera'

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  status: CameraStatus
  errorMessage: string | null
  hint: string | null
  onStart: () => void
}

/**
 * The mirrored webcam picture with a transparent <canvas> stacked exactly on
 * top of it — like a clear sticker sheet — where the face dots are drawn.
 */
export function CameraView({ videoRef, canvasRef, status, errorMessage, hint, onStart }: Props) {
  const showOverlay = status !== 'live'

  return (
    <div className="camera">
      <video ref={videoRef} className="camera__video" playsInline muted />
      <canvas ref={canvasRef} className="camera__canvas" />

      {!showOverlay && hint && <p className="camera__hint">{hint}</p>}

      {showOverlay && (
        <div className="camera__overlay">
          {status === 'starting' ? (
            <p>Waiting for camera permission…</p>
          ) : (
            <>
              {errorMessage && <p className="camera__error">{errorMessage}</p>}
              <button type="button" className="button" onClick={onStart}>
                {status === 'idle' ? 'Start camera' : 'Try again'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
