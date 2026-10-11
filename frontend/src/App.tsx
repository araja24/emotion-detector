import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CameraView } from './components/CameraView'
import { Controls } from './components/Controls'
import { EmotionBars } from './components/EmotionBars'
import { StatusBadge, type Tone } from './components/StatusBadge'
import { useCamera, type CameraStatus } from './hooks/useCamera'
import { useEmotionSocket, type SocketStatus } from './hooks/useEmotionSocket'
import { useFaceLandmarker, type LandmarkerStatus } from './hooks/useFaceLandmarker'
import { cropFace, faceBox } from './lib/cropFace'
import { drawEmotionLabel, drawLandmarks, type DrawOptions } from './lib/drawLandmarks'
import { EMOTION_INFO } from './lib/emotions'

type Badge = { value: string; tone: Tone }

function cameraBadge(status: CameraStatus): Badge {
  if (status === 'live') return { value: 'on', tone: 'good' }
  if (status === 'starting') return { value: 'starting', tone: 'wait' }
  if (status === 'idle') return { value: 'off', tone: 'off' }
  return { value: 'blocked', tone: 'bad' }
}

function faceBadge(isLive: boolean, paused: boolean, status: LandmarkerStatus, faceFound: boolean): Badge {
  if (!isLive) return { value: '—', tone: 'off' }
  if (paused) return { value: 'paused', tone: 'wait' }
  if (status === 'loading') return { value: 'loading', tone: 'wait' }
  if (status === 'error') return { value: 'error', tone: 'bad' }
  return faceFound ? { value: 'found', tone: 'good' } : { value: 'not found', tone: 'bad' }
}

function backendBadge(status: SocketStatus): Badge {
  if (status === 'open') return { value: 'connected', tone: 'good' }
  if (status === 'connecting') return { value: 'connecting', tone: 'wait' }
  return { value: 'disconnected', tone: 'bad' }
}

function App() {
  const camera = useCamera()
  const socket = useEmotionSocket()
  const { trySend, result } = socket
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRef = useRef<string | null>(null)
  const lastFaceRef = useRef<NormalizedLandmark[] | null>(null)
  const [showDots, setShowDots] = useState(true)
  const [showLines, setShowLines] = useState(true)
  const [paused, setPaused] = useState(false)
  const drawOptionsRef = useRef<DrawOptions>({ showDots, showLines })
  const isLive = camera.status === 'live'

  // The draw loop runs outside React, so hand it the latest label through a ref.
  useEffect(() => {
    if (!result) return
    const { emoji, label } = EMOTION_INFO[result.top]
    labelRef.current = `${emoji} ${label} ${Math.round(result.smoothed[result.top] * 100)}%`
  }, [result])

  // The draw loop reads the switches through a ref so toggling doesn't restart it.
  useEffect(() => {
    drawOptionsRef.current = { showDots, showLines }
  }, [showDots, showLines])

  /** Paints the dots, lines and label for one face (or clears the canvas). */
  const paint = useCallback((face: NormalizedLandmark[] | null) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!face) return
    drawLandmarks(ctx, face, drawOptionsRef.current)
    if (labelRef.current) drawEmotionLabel(ctx, face, labelRef.current)
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
      if (face) trySend(() => cropFace(video, faceBox(face, video.videoWidth, video.videoHeight)))
    },
    [paint, trySend],
  )

  const landmarker = useFaceLandmarker(camera.videoRef, isLive && !paused, handleFrame)

  // Freeze / unfreeze the picture itself.
  useEffect(() => {
    const video = camera.videoRef.current
    if (!video || !isLive) return
    if (paused) video.pause()
    else video.play().catch(() => {})
  }, [paused, isLive, camera.videoRef])

  // While paused, flipping a switch should still update the frozen picture.
  useEffect(() => {
    if (paused) paint(lastFaceRef.current)
  }, [paused, showDots, showLines, paint])

  // Wipe leftover dots when the camera stops.
  useEffect(() => {
    if (isLive) return
    lastFaceRef.current = null
    paint(null)
  }, [isLive, paint])

  const stopCamera = () => {
    setPaused(false)
    camera.stop()
  }

  let hint: string | null = null
  if (paused) hint = 'Paused ⏸'
  else if (landmarker.status === 'loading') hint = 'Loading face detector…'
  else if (landmarker.status === 'error') hint = 'Face detector failed to load — check the console.'
  else if (!landmarker.faceFound) hint = 'No face found 👀'

  let barsNote: string | null = null
  if (socket.status !== 'open') barsNote = 'Backend disconnected — start it on port 8000. Reconnecting automatically…'
  else if (!result) barsNote = isLive ? 'Waiting for a face…' : 'Start the camera to see emotion confidences.'
  else if (paused) barsNote = 'Paused — showing the last reading.'
  else if (isLive && !landmarker.faceFound) barsNote = 'No face — showing the last reading.'

  return (
    <div className="app">
      <header className="app__header">
        <h1>Emotion Detector</h1>
        {isLive && (
          <button type="button" className="button button--ghost" onClick={stopCamera}>
            Stop camera
          </button>
        )}
      </header>

      <main className="app__main">
        <section className="stage">
          <CameraView
            videoRef={camera.videoRef}
            canvasRef={canvasRef}
            status={camera.status}
            errorMessage={camera.errorMessage}
            hint={hint}
            onStart={camera.start}
          />
          {isLive && (
            <Controls
              showDots={showDots}
              showLines={showLines}
              paused={paused}
              onShowDotsChange={setShowDots}
              onShowLinesChange={setShowLines}
              onPausedChange={setPaused}
            />
          )}
        </section>

        <aside className="panel">
          <div className="badges">
            <StatusBadge label="Camera" {...cameraBadge(camera.status)} />
            <StatusBadge label="Face" {...faceBadge(isLive, paused, landmarker.status, landmarker.faceFound)} />
            <StatusBadge label="Backend" {...backendBadge(socket.status)} />
          </div>

          <div className="panel__heading">
            <h2>Emotions</h2>
            {socket.models.length > 1 && (
              <label className="model-picker">
                <span className="muted">Model</span>
                <select value={socket.activeModel ?? ''} onChange={(e) => socket.setModel(e.target.value)}>
                  {socket.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <EmotionBars scores={result?.smoothed ?? null} top={result?.top ?? null} />
          {barsNote && <p className="muted note">{barsNote}</p>}

          {isLive && !paused && landmarker.status === 'ready' && (
            <p className="muted stat">
              Face dots: {landmarker.fps} FPS · Emotions: {socket.answersPerSecond}/s
              {result && ` · model ${result.ms} ms`}
            </p>
          )}
        </aside>
      </main>

      <footer className="app__footer muted">
        Your video never leaves this computer except as small face crops sent to your own local backend, and
        nothing is saved. Emotion guesses come from facial expressions only and can be wrong.
      </footer>
    </div>
  )
}

export default App
