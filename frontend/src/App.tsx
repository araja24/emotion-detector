import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ControlBar } from './components/ControlBar'
import { Header, type Pill } from './components/Header'
import { Readout } from './components/Readout'
import { Stage, type StageNotice } from './components/Stage'
import { useCamera } from './hooks/useCamera'
import { useEmotionSocket } from './hooks/useEmotionSocket'
import { useFaceLandmarker } from './hooks/useFaceLandmarker'
import { cropFace, faceBox } from './lib/cropFace'
import { drawLandmarks, type DrawOptions } from './lib/drawLandmarks'
import { EMOTIONS, EMOTION_INFO, NEUTRAL_ACCENT } from './lib/emotions'
import { faceAnchor, withAlpha } from './lib/stage'
import { TRAIL_INTERVAL_MS, emptyTrail, pushTrail, trailEntry } from './lib/trail'

/** Below this stage width the label sits centred above the head instead of beside it. */
const NARROW_STAGE_PX = 520
/** How far the label's tail tip sits from its left edge in 'side' mode (matches the CSS). */
const LABEL_TAIL_INSET = 22
/** Keep the label below the LIVE chip even when the head is at the very top of the frame. */
const LABEL_MIN_TOP = 64

function App() {
  const camera = useCamera()
  const socket = useEmotionSocket()
  const { trySend, result } = socket
  const isLive = camera.status === 'live'

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const labelTailRef = useRef<HTMLSpanElement>(null)
  const lastFaceRef = useRef<NormalizedLandmark[] | null>(null)

  const [showDots, setShowDots] = useState(true)
  const [showMesh, setShowMesh] = useState(true)
  const [paused, setPaused] = useState(false)
  const [pausedWithFace, setPausedWithFace] = useState(false)
  const [trail, setTrail] = useState(emptyTrail)
  const [idleTick, setIdleTick] = useState(0)

  // ---------- face tracking + drawing (runs outside React, once per video frame) ----------

  const drawOptionsRef = useRef<DrawOptions>({ showDots, showMesh, accent: NEUTRAL_ACCENT })

  /** Paints the mesh for one face (or clears the canvas). */
  const paint = useCallback((face: NormalizedLandmark[] | null) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (face) drawLandmarks(ctx, face, drawOptionsRef.current)
  }, [])

  /** Moves the floating label so its tail points at the top of the head. */
  const placeLabel = useCallback((face: NormalizedLandmark[], video: HTMLVideoElement) => {
    const stage = stageRef.current
    const label = labelRef.current
    const tail = labelTailRef.current
    if (!stage || !label || !tail || label.hidden) return
    const stageSize = { width: stage.clientWidth, height: stage.clientHeight }
    const mode = stageSize.width < NARROW_STAGE_PX ? 'center' : 'side'
    const anchor = faceAnchor(face, { width: video.videoWidth, height: video.videoHeight }, stageSize, mode)
    const width = label.offsetWidth
    const height = label.offsetHeight
    const wantedLeft = mode === 'center' ? anchor.x - width / 2 : anchor.x - LABEL_TAIL_INSET
    const left = Math.min(Math.max(wantedLeft, 12), stageSize.width - width - 12)
    const top = Math.max(anchor.y - height - 16, LABEL_MIN_TOP)
    label.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`
    tail.style.left = `${Math.min(Math.max(anchor.x - left - 6, 14), width - 26).toFixed(1)}px`
  }, [])

  const handleFrame = useCallback(
    (face: NormalizedLandmark[] | null, video: HTMLVideoElement) => {
      const canvas = canvasRef.current
      // Match the canvas to the camera's real resolution so dots line up exactly.
      if (canvas && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }
      lastFaceRef.current = face
      paint(face)
      if (!face) return
      placeLabel(face, video)
      trySend(() => cropFace(video, faceBox(face, video.videoWidth, video.videoHeight)))
    },
    [paint, placeLabel, trySend],
  )

  const landmarker = useFaceLandmarker(camera.videoRef, isLive && !paused, handleFrame)

  // ---------- what state are we in? ----------

  // The tracker stops while paused, so remember whether there was a face when we paused.
  const faceSeen = isLive && (paused ? pausedWithFace : landmarker.faceFound)
  const backendOpen = socket.status === 'open'
  const reading = faceSeen && backendOpen && result !== null && landmarker.status === 'ready'
  const top = result?.top ?? null

  const idleColor = EMOTION_INFO[EMOTIONS[Math.floor(idleTick / 2) % EMOTIONS.length]].color
  const accent = reading && top ? EMOTION_INFO[top].color : isLive ? NEUTRAL_ACCENT : idleColor

  useEffect(() => {
    drawOptionsRef.current = { showDots, showMesh, accent }
  }, [showDots, showMesh, accent])

  // While the camera is off, slowly cycle the mood colours and pulse the dotted face.
  useEffect(() => {
    if (isLive) return
    const timer = window.setInterval(() => setIdleTick((t) => t + 1), 625)
    return () => window.clearInterval(timer)
  }, [isLive])

  // "Last 10 seconds": sample the reading 4x a second while live.
  const sampleRef = useRef({ reading, backendOpen, scores: result?.smoothed ?? null })
  useEffect(() => {
    sampleRef.current = { reading, backendOpen, scores: result?.smoothed ?? null }
  }, [reading, backendOpen, result])
  useEffect(() => {
    if (!isLive || paused) return
    const timer = window.setInterval(() => setTrail((t) => pushTrail(t, trailEntry(sampleRef.current))), TRAIL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [isLive, paused])

  // Freeze / unfreeze the picture itself.
  useEffect(() => {
    const video = camera.videoRef.current
    if (!video || !isLive) return
    if (paused) video.pause()
    else video.play().catch(() => {})
  }, [paused, isLive, camera.videoRef])

  // While paused, flipping a switch or a mood change should still update the frozen picture.
  useEffect(() => {
    if (paused) paint(lastFaceRef.current)
  }, [paused, showDots, showMesh, accent, paint])

  // Wipe leftover dots when the camera stops.
  useEffect(() => {
    if (isLive) return
    lastFaceRef.current = null
    paint(null)
  }, [isLive, paint])

  // ---------- actions ----------

  const toggleCamera = () => {
    if (isLive) {
      setPaused(false)
      setTrail(emptyTrail())
      camera.stop()
    } else {
      void camera.start()
    }
  }

  const togglePause = () => {
    if (!paused) setPausedWithFace(landmarker.faceFound)
    setPaused(!paused)
  }

  // ---------- text for each state ----------

  const pills: Pill[] = [
    isLive ? { label: 'Camera on', tone: 'ok' } : { label: 'Camera off', tone: 'idle' },
    !isLive
      ? { label: 'No face yet', tone: 'idle' }
      : faceSeen
        ? { label: 'Face found', tone: 'ok' }
        : { label: 'No face found', tone: 'warn' },
    backendOpen
      ? { label: 'Backend connected', tone: 'ok' }
      : socket.status === 'connecting'
        ? { label: 'Connecting', tone: 'warn' }
        : { label: 'Backend disconnected', tone: 'bad' },
  ]

  let notice: StageNotice = 'none'
  if (isLive && !paused) {
    if (landmarker.status === 'loading') notice = 'loading'
    else if (landmarker.status === 'error') notice = 'trackerError'
    else if (!landmarker.faceFound) notice = 'noFace'
  }

  const topPct = reading && result && top ? `${Math.round(result.smoothed[top] * 100)}%` : ''
  let headline = { name: 'Ready', color: '#ECEEF2', pct: '', voice: 'Turn on your camera and Mien starts reading.' }
  if (isLive && !faceSeen) headline = { name: 'Hello?', color: '#ECEEF2', pct: '', voice: 'No face in frame right now.' }
  else if (isLive && !backendOpen)
    headline = { name: 'On hold', color: '#AEB4BF', pct: '', voice: 'Model unreachable. Last reading shown, faded.' }
  else if (isLive && !reading) headline = { name: 'Reading…', color: '#ECEEF2', pct: '', voice: 'Hold still for a moment.' }
  else if (reading && top) {
    const info = EMOTION_INFO[top]
    headline = { name: info.label, color: info.color, pct: topPct, voice: paused ? 'Paused on this frame.' : info.voice }
  }

  const fps = `${landmarker.fps} fps`
  let statsText = `${fps} · ${result ? Math.round(result.latencyMs) : '—'} ms latency · 478 pts`
  if (paused) statsText = 'Frozen · 0 fps'
  else if (!faceSeen) statsText = `${fps} · searching…`
  else if (!backendOpen) statsText = `${fps} · model offline`

  const label =
    reading && top ? { ...EMOTION_INFO[top], name: EMOTION_INFO[top].label, pct: topPct } : null

  const rootStyle = {
    '--accent': accent,
    '--accent-rim': isLive ? withAlpha(accent, 0.35) : 'rgba(255,255,255,0.08)',
    '--accent-ring': withAlpha(accent, 0.07),
    '--accent-glow': withAlpha(accent, 0.53),
  } as CSSProperties

  return (
    <div className="app" style={rootStyle}>
      <div className="aura aura--top" aria-hidden="true" />
      <div className="aura aura--bottom" aria-hidden="true" />
      <div className="app__inner">
        <Header accent={accent} pills={pills} />

        <div className="app__main">
          <section className="camera" aria-label="Camera">
            <Stage
              videoRef={camera.videoRef}
              canvasRef={canvasRef}
              stageRef={stageRef}
              labelRef={labelRef}
              labelTailRef={labelTailRef}
              cameraStatus={camera.status}
              cameraError={camera.errorMessage}
              reading={reading}
              paused={paused}
              notice={notice}
              offline={!backendOpen}
              retryAt={socket.retryAt}
              statsText={statsText}
              accent={accent}
              idlePulse={idleTick % 2 === 0}
              label={label}
              onStartCamera={() => void camera.start()}
              onRetry={socket.reconnectNow}
            />
            <ControlBar
              live={isLive}
              paused={paused}
              showDots={showDots}
              showMesh={showMesh}
              models={socket.models}
              activeModel={socket.activeModel}
              onToggleCamera={toggleCamera}
              onTogglePause={togglePause}
              onToggleDots={() => setShowDots((v) => !v)}
              onToggleMesh={() => setShowMesh((v) => !v)}
              onModelChange={socket.setModel}
            />
          </section>

          <Readout
            headline={headline}
            readsPerSecond={isLive ? socket.answersPerSecond : 0}
            scores={isLive ? (result?.smoothed ?? null) : null}
            reading={reading}
            showNumbers={isLive && faceSeen && result !== null}
            top={top}
            trail={trail}
          />
        </div>
      </div>
    </div>
  )
}

export default App
