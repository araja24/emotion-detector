import { useCallback, useEffect, useRef, useState } from 'react'
import type { Emotion, EmotionScores } from '../lib/emotions'
import { smoothScores, topEmotion } from '../lib/smoothing'

export type ModelInfo = { id: string; name: string }

type ServerMessage =
  | { models: ModelInfo[]; model: string } // hello, sent once on connect
  | { emotions: EmotionScores; top: Emotion; ms: number; model: string } // answer to a picture
  | { model: string } // "switched model" confirmation
  | { error: string }

/** `smoothed` is what we show; `raw` is the backend's latest answer as-is. */
export type EmotionResult = { raw: EmotionScores; smoothed: EmotionScores; top: Emotion; ms: number }
export type SocketStatus = 'connecting' | 'open' | 'closed'

/** At most one picture per this many ms (~8 per second). */
const SEND_INTERVAL_MS = 120
/** If an answer never comes back, stop waiting after this long. */
const REPLY_TIMEOUT_MS = 2000
const MAX_RECONNECT_DELAY_MS = 10_000

function socketUrl() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${location.host}/ws`
}

/**
 * Keeps one WebSocket open to the backend (reconnecting by itself if it
 * drops) and sends face pictures — but only one at a time: a new picture is
 * sent only after the previous answer has arrived.
 */
export function useEmotionSocket() {
  const [status, setStatus] = useState<SocketStatus>('connecting')
  const [result, setResult] = useState<EmotionResult | null>(null)
  const [answersPerSecond, setAnswersPerSecond] = useState(0)
  const socketRef = useRef<WebSocket | null>(null)
  const busySinceRef = useRef<number | null>(null)
  const lastSentRef = useRef(0)
  const answerTimesRef = useRef<number[]>([])
  const smoothedRef = useRef<EmotionScores | null>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [activeModel, setActiveModel] = useState<string | null>(null)
  const wantedModelRef = useRef<string | null>(null)

  useEffect(() => {
    let closedByUs = false
    let retryDelay = 1000
    let retryTimer: number | undefined

    const connect = () => {
      setStatus('connecting')
      const socket = new WebSocket(socketUrl())
      socket.binaryType = 'arraybuffer'
      socketRef.current = socket

      socket.onopen = () => {
        retryDelay = 1000
        busySinceRef.current = null
        setStatus('open')
      }
      socket.onmessage = (event) => {
        let message: ServerMessage
        try {
          message = JSON.parse(event.data)
        } catch {
          return
        }

        if ('models' in message) {
          // Hello: what models exist. After a reconnect, re-pick the one the user chose.
          setModels(message.models)
          const wanted = wantedModelRef.current
          if (wanted && wanted !== message.model && message.models.some((m) => m.id === wanted)) {
            socket.send(JSON.stringify({ model: wanted }))
          } else {
            setActiveModel(message.model)
          }
          return
        }
        if ('emotions' in message) {
          busySinceRef.current = null
          // An answer from the previous model can still be in flight right after a switch.
          if (message.model !== wantedModelRef.current && wantedModelRef.current !== null) return
          const smoothed = smoothScores(smoothedRef.current, message.emotions)
          smoothedRef.current = smoothed
          setResult({ raw: message.emotions, smoothed, top: topEmotion(smoothed), ms: message.ms })
          const now = performance.now()
          answerTimesRef.current = [...answerTimesRef.current.filter((t) => now - t < 1000), now]
          return
        }
        if ('model' in message) {
          // Switch confirmed: start the smoothing fresh so the old model's answers don't linger.
          setActiveModel(message.model)
          smoothedRef.current = null
          return
        }
        busySinceRef.current = null // an error reply also ends the wait
      }
      socket.onclose = () => {
        // An old socket closing late must not wipe out its replacement.
        if (socketRef.current === socket) socketRef.current = null
        busySinceRef.current = null
        if (closedByUs) return
        setStatus('closed')
        retryTimer = window.setTimeout(connect, retryDelay)
        retryDelay = Math.min(retryDelay * 2, MAX_RECONNECT_DELAY_MS)
      }
    }
    connect()

    const statsTimer = window.setInterval(() => {
      const now = performance.now()
      answerTimesRef.current = answerTimesRef.current.filter((t) => now - t < 1000)
      setAnswersPerSecond(answerTimesRef.current.length)
    }, 500)

    return () => {
      closedByUs = true
      window.clearTimeout(retryTimer)
      window.clearInterval(statsTimer)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [])

  /**
   * Sends a picture if the line is free. `makePicture` is only called when we
   * will actually send, so no work is wasted on frames we'd skip anyway.
   */
  const trySend = useCallback((makePicture: () => Promise<Blob>) => {
    const socket = socketRef.current
    const now = performance.now()
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    const busySince = busySinceRef.current
    if (busySince !== null && now - busySince < REPLY_TIMEOUT_MS) return
    if (now - lastSentRef.current < SEND_INTERVAL_MS) return

    busySinceRef.current = now
    lastSentRef.current = now
    makePicture()
      .then((blob) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(blob)
        else busySinceRef.current = null
      })
      .catch(() => {
        busySinceRef.current = null
      })
  }, [])

  /** Ask the backend to use a different emotion model (remembered across reconnects). */
  const setModel = useCallback((modelId: string) => {
    wantedModelRef.current = modelId
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ model: modelId }))
  }, [])

  return { status, result, answersPerSecond, trySend, models, activeModel, setModel }
}
