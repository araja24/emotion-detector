import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import { useEffect, useRef, useState, type RefObject } from 'react'

const WASM_PATH = '/mediapipe/wasm'
const MODEL_PATH = '/models/face_landmarker.task'

export type LandmarkerStatus = 'loading' | 'ready' | 'error'
export type Delegate = 'GPU' | 'CPU'

/** Called once per analysed video frame; `null` means "no face in this frame". */
export type FrameCallback = (face: NormalizedLandmark[] | null, video: HTMLVideoElement) => void

/** `?delegate=cpu` or `?delegate=gpu` in the page URL forces one (handy for comparing on a device). */
function forcedDelegate(): Delegate | null {
  const value = new URLSearchParams(location.search).get('delegate')?.toUpperCase()
  return value === 'GPU' || value === 'CPU' ? value : null
}

async function createLandmarker(): Promise<{ landmarker: FaceLandmarker; delegate: Delegate }> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
  const create = async (delegate: Delegate) => ({
    landmarker: await FaceLandmarker.createFromOptions(fileset, options(delegate)),
    delegate,
  })
  const options = (delegate: Delegate) => ({
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: 'VIDEO' as const,
    numFaces: 1,
  })
  const forced = forcedDelegate()
  if (forced) return create(forced)
  try {
    return await create('GPU')
  } catch {
    // Some machines/browsers have no usable WebGL. The CPU is slower but works.
    return await create('CPU')
  }
}

/**
 * Loads MediaPipe's Face Landmarker once, then, while `running` is true,
 * looks at every new video frame and hands the 478 face points to `onFrame`.
 *
 * The points go straight to a callback (not React state) because they change
 * ~30 times a second; re-rendering React that often would be wasteful.
 */
export function useFaceLandmarker(
  videoRef: RefObject<HTMLVideoElement | null>,
  running: boolean,
  onFrame: FrameCallback,
) {
  const [status, setStatus] = useState<LandmarkerStatus>('loading')
  const [faceFound, setFaceFound] = useState(false)
  const [fps, setFps] = useState(0)
  const [delegate, setDelegate] = useState<Delegate | null>(null)
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const onFrameRef = useRef(onFrame)

  useEffect(() => {
    onFrameRef.current = onFrame
  }, [onFrame])

  // 1. Load the model once.
  useEffect(() => {
    let cancelled = false
    createLandmarker()
      .then(({ landmarker, delegate }) => {
        if (cancelled) {
          landmarker.close()
          return
        }
        landmarkerRef.current = landmarker
        setDelegate(delegate)
        setStatus('ready')
      })
      .catch((err) => {
        console.error('Face Landmarker failed to load', err)
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  // 2. While running, analyse each new video frame.
  useEffect(() => {
    if (!running || status !== 'ready') return

    let frameId = 0
    let lastVideoTime = -1
    let lastFaceFound = false
    let framesThisSecond = 0
    let secondStart = performance.now()

    const loop = () => {
      frameId = requestAnimationFrame(loop)
      const video = videoRef.current
      const landmarker = landmarkerRef.current
      if (!video || !landmarker || video.readyState < 2) return
      // Only analyse a frame once, even if the screen refreshes faster than the camera.
      if (video.currentTime === lastVideoTime) return
      lastVideoTime = video.currentTime

      const now = performance.now()
      const result = landmarker.detectForVideo(video, now)
      const face = result.faceLandmarks[0] ?? null
      onFrameRef.current(face, video)

      const found = face !== null
      if (found !== lastFaceFound) {
        lastFaceFound = found
        setFaceFound(found)
      }

      framesThisSecond++
      if (now - secondStart >= 1000) {
        setFps(Math.round((framesThisSecond * 1000) / (now - secondStart)))
        framesThisSecond = 0
        secondStart = now
      }
    }
    frameId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frameId)
      setFaceFound(false)
      setFps(0)
    }
  }, [running, status, videoRef])

  return { status, faceFound, fps, delegate }
}
