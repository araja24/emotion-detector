import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import type { CameraStatus } from '../hooks/useCamera'
import { CameraIcon, DottedFace, LockIcon, RetryIcon, SearchFaceIcon, UnlinkIcon } from './icons'

export type StageNotice = 'none' | 'loading' | 'trackerError' | 'noFace'

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  stageRef: RefObject<HTMLDivElement | null>
  labelRef: RefObject<HTMLDivElement | null>
  labelTailRef: RefObject<HTMLSpanElement | null>
  cameraStatus: CameraStatus
  cameraError: string | null
  reading: boolean
  paused: boolean
  notice: StageNotice
  offline: boolean
  retryAt: number | null
  statsText: string
  accent: string
  idlePulse: boolean
  label: { emoji: string; name: string; pct: string; color: string } | null
  onStartCamera: () => void
  onRetry: () => void
}

/**
 * The camera "stage": mirrored video + landmark canvas, framed with mood-tinted
 * corners, a LIVE chip, stats, a floating label that follows the face, and the
 * empty / no-face / offline overlays.
 */
export function Stage(props: Props) {
  const { videoRef, canvasRef, stageRef, labelRef, labelTailRef } = props
  const { cameraStatus, reading, paused, notice, offline, accent, label } = props
  const live = cameraStatus === 'live'

  return (
    <div ref={stageRef} className={`stage${reading ? ' stage--reading' : ''}${live ? ' stage--live' : ''}`}>
      <div className="stage__aura" aria-hidden="true" />
      <video ref={videoRef} className="stage__video" playsInline muted />
      <canvas ref={canvasRef} className="stage__canvas" aria-hidden="true" />

      {live && (
        <>
          <span className="corner corner--tl" aria-hidden="true" />
          <span className="corner corner--tr" aria-hidden="true" />
          <span className="corner corner--bl" aria-hidden="true" />
          <span className="corner corner--br" aria-hidden="true" />
          <div className="chip chip--live">
            <span className={`chip__dot${paused ? ' chip__dot--paused' : ''}`} aria-hidden="true" />
            {paused ? 'Paused' : 'Live'}
          </div>
          <div className="chip chip--stats">{props.statsText}</div>
        </>
      )}

      {/* Positioned every frame by App (it follows the face), so React only sets its contents. */}
      <div
        ref={labelRef}
        className="face-label"
        hidden={!label}
        style={label ? { background: label.color, boxShadow: `0 14px 34px -10px ${label.color}` } : undefined}
      >
        <span ref={labelTailRef} className="face-label__tail" aria-hidden="true" />
        {label && (
          <>
            <span className="face-label__emoji" aria-hidden="true">
              {label.emoji}
            </span>
            <span>{label.name}</span>
            <span className="face-label__pct">{label.pct}</span>
          </>
        )}
      </div>

      {!live && (
        <div className="empty">
          <DottedFace color={accent} opacity={props.idlePulse ? 1 : 0.55} />
          <h1 className="empty__title">Make a face.</h1>
          {props.cameraError ? (
            <p className="empty__text empty__text--error" role="alert">
              {props.cameraError}
            </p>
          ) : (
            <p className="empty__text">Mien reads eight expressions as they happen, about eight times a second.</p>
          )}
          <button
            type="button"
            className="btn btn--light btn--big"
            onClick={props.onStartCamera}
            disabled={cameraStatus === 'starting'}
          >
            <CameraIcon size={20} />
            {cameraStatus === 'starting' ? 'Waiting for permission…' : props.cameraError ? 'Try again' : 'Turn on camera'}
          </button>
          <p className="fineprint">
            <LockIcon />
            Video stays in your browser. Nothing is saved.
          </p>
        </div>
      )}

      {live && notice !== 'none' && (
        <div className="notice-wrap">
          <div className="notice" role="status">
            {notice === 'noFace' && <SearchFaceIcon />}
            <h2 className="notice__title">
              {notice === 'noFace' && 'Lost you for a sec'}
              {notice === 'loading' && 'Warming up'}
              {notice === 'trackerError' && 'Face tracker didn’t load'}
            </h2>
            <p className="notice__text">
              {notice === 'noFace' &&
                'Look toward the camera and find a little light. Mien will pick you back up on its own.'}
              {notice === 'loading' && 'Loading the face tracker. This takes a moment the first time.'}
              {notice === 'trackerError' && 'Try reloading the page. If it keeps happening, try another browser.'}
            </p>
          </div>
        </div>
      )}

      {live && offline && <OfflineBanner retryAt={props.retryAt} onRetry={props.onRetry} />}
    </div>
  )
}

function OfflineBanner({ retryAt, onRetry }: { retryAt: number | null; onRetry: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])

  let when: ReactNode = 'Connecting…'
  if (retryAt !== null) {
    const seconds = Math.max(0, Math.ceil((retryAt - now) / 1000))
    when = seconds > 0 ? `Trying again in ${seconds}s…` : 'Trying again…'
  }

  return (
    <div className="offline" role="status">
      <UnlinkIcon />
      <div className="offline__text">
        <div className="offline__title">Can’t reach the emotion model</div>
        <div className="offline__body">Your camera’s fine and face tracking keeps running. {when}</div>
      </div>
      <button type="button" className="btn btn--ghost btn--small" onClick={onRetry} disabled={retryAt === null}>
        <RetryIcon />
        Retry now
      </button>
    </div>
  )
}
