// Puts the files MediaPipe needs at runtime into public/ so Vite can serve them:
//   public/mediapipe/wasm/            ← the engine, copied from node_modules
//   public/models/face_landmarker.task ← the face-dot model, downloaded once
// Runs automatically before `npm run dev` and `npm run build`.
import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const modelPath = join(root, 'public', 'models', 'face_landmarker.task')

const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const wasmDest = join(root, 'public', 'mediapipe', 'wasm')

cpSync(wasmSrc, wasmDest, { recursive: true })
console.log('[setup-assets] MediaPipe wasm ready')

if (existsSync(modelPath) && statSync(modelPath).size > 0) {
  console.log('[setup-assets] face_landmarker.task already present')
} else {
  console.log('[setup-assets] downloading face_landmarker.task …')
  const response = await fetch(MODEL_URL)
  if (!response.ok) throw new Error(`Model download failed: HTTP ${response.status}`)
  mkdirSync(dirname(modelPath), { recursive: true })
  writeFileSync(modelPath, Buffer.from(await response.arrayBuffer()))
  console.log(`[setup-assets] saved ${(statSync(modelPath).size / 1e6).toFixed(1)} MB`)
}
