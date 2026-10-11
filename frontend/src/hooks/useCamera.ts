import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStatus = 'idle' | 'starting' | 'live' | 'denied' | 'no-camera' | 'error'

/**
 * Turns the webcam on and off and plugs its stream into a <video> element.
 * Attach `videoRef` to the <video>, then call `start()` (from a click, so the
 * browser is happy to show its "Allow camera?" prompt).
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }, [])

  const start = useCallback(async () => {
    if (streamRef.current) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setErrorMessage('This browser cannot use the camera (try Chrome, Edge or Firefox on localhost or https).')
      return
    }

    setStatus('starting')
    setErrorMessage(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play()
      }
      setStatus('live')
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('denied')
        setErrorMessage('Camera permission was blocked. Allow it in the address bar, then try again.')
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setStatus('no-camera')
        setErrorMessage('No camera was found. Plug one in and try again.')
      } else if (name === 'NotReadableError') {
        setStatus('error')
        setErrorMessage('The camera is busy — another app might be using it.')
      } else {
        setStatus('error')
        setErrorMessage(err instanceof Error ? err.message : 'Could not start the camera.')
      }
    }
  }, [])

  // Turn the camera light off when the page/component goes away.
  useEffect(() => stop, [stop])

  return { videoRef, status, errorMessage, start, stop }
}
