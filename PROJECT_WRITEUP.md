# Emotion Detector: Project Write-Up

A real-time facial emotion recognition web app. It runs in the browser using a webcam, draws a 478-point face mesh over the user's face, and shows a live confidence score for each of 8 emotions. The video is analysed on the user's machine, and only small face crops go to a Python inference service.

This document records what was built, the engineering decisions made along the way and why, the problems hit and how they were solved, and the measured results. For setup instructions see [README.md](README.md). For the original design see [PLAN.md](PLAN.md).

---

## At a glance

| | |
|---|---|
| **What** | Real-time emotion recognition from a webcam: face landmarks + 8-class emotion confidence |
| **Frontend** | React 19, TypeScript, Vite 8, MediaPipe Face Landmarker (WebAssembly/WebGL), Canvas 2D |
| **Backend** | Python 3.12, FastAPI, WebSockets, ONNX Runtime, OpenCV, NumPy |
| **ML models** | HSEmotion EfficientNet-B0 (default), HSEmotion EfficientNet-B2, FER+ (all ONNX) |
| **Testing** | pytest (35 tests), Vitest (8 tests), Playwright end-to-end scripts against Edge |
| **Deployment** | Render Blueprint (`render.yaml`): one web service serves the site + WebSocket API |
| **Performance** | ~8 emotion answers/s per user, ~25 ms round trip, ~6–10 ms model inference on CPU, ~120 MB server RAM |

---

## Architecture

```
┌──────────────────────── Browser (React + TypeScript) ────────────────────────┐
│ getUserMedia ─► <video> ─► MediaPipe Face Landmarker (WASM, GPU→CPU fallback) │
│                               │ 478 landmarks per frame                        │
│                               ├─► <canvas> overlay: mesh, contours, dots, label│
│                               └─► square face crop (224×224 JPEG, ~sync encode)│
│                                       │  WebSocket (binary), 1 frame in flight │
└───────────────────────────────────────┼──────────────────────────────────────┘
                                        ▼
┌──────────────────────── FastAPI service (Python) ────────────────────────────┐
│ /ws: decode ─► model-specific preprocessing ─► ONNX Runtime ─► softmax        │
│      ─► {"emotions": {...8 probs}, "top", "ms", "model"}                       │
│ /health: liveness. "/": serves the built React site (production)            │
└───────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
        Browser: exponential smoothing ─► confidence bars + on-face label
```

**Why this split:** landmarks run *client-side* because they need to track the face at camera frame rate. A server round trip per frame would make the mesh lag behind the face. Emotion classification runs *server-side* in Python, where the ML tooling lives. Swapping models there never touches the UI, which turned out to matter later (see Decision 5). Emotions only need to update about 8 times a second to feel live, so the network cost stays small.

---

## Build timeline

The project was built in seven planned milestones. Each one ended in something that could be seen working and was verified in a real browser.

1. **Skeleton.** Vite + React + TS app; FastAPI app with `/health`; the Vite dev proxy forwards `/health` and `/ws` so the browser only talks to one origin.
2. **Camera.** `useCamera` hook with friendly handling for each `getUserMedia` failure: permission denied, no device, device busy. The camera light turns off on unmount.
3. **Face mesh.** `useFaceLandmarker` hook runs MediaPipe once per new video frame. A mirrored canvas overlay draws the tessellation, the contours (eyes, brows, lips, irises, face oval) and the 478 points. Asset setup is automated: MediaPipe's WASM is copied and the landmark model downloaded before `dev` and `build`.
4. **Emotion model (backend).** Preprocessing + ONNX inference + numerically stable softmax, written test-first.
5. **Client ↔ server.** WebSocket protocol, face cropping, automatic reconnect with exponential backoff (1 s → 10 s), and backpressure (at most one frame in flight).
6. **Confidence UI.** Accessible bar meters (`role="meter"`), emoji labels, status pills (camera, face, backend), on-face label, exponential moving average smoothing.
7. **Polish.** Dots/lines toggles and pause/resume, which freezes video and analysis but keeps the last reading. README.

After the milestones:

8. **Model upgrade.** FER+ was replaced by HSEmotion as the default, and a live model picker was added to compare models.
9. **Deployment.** Single-service Render Blueprint, build script, production static serving, configurable model loading.

---

## Key decisions

### 1. Hybrid client/server inference instead of all-server or all-client

- **Options:** send every frame to the server; run everything in the browser; split the work.
- **Chosen:** landmarks in the browser (MediaPipe WASM), emotion classification on the server (Python/ONNX).
- **Why:** the overlay must stay locked to the face at camera frame rate, which rules out a network hop per frame. Keeping classification in Python makes the model swappable and testable with the standard ML toolchain, and lets the project show a real backend.
- **Trade-off:** face crops leave the browser. This is stated on the page, and crops are processed in memory and never stored.

### 2. WebSocket with explicit backpressure instead of HTTP requests

- A persistent binary WebSocket avoids per-request overhead.
- **Backpressure rule:** at most **2 frames in flight** (originally 1; see Decision 8), a 120 ms minimum spacing, and a 2 s timeout in case a reply is lost. A slow server therefore lowers the update rate instead of building up a queue of stale frames and growing latency.
- The crop is only encoded when it will actually be sent, so no CPU is spent on frames that would be dropped.

### 3. Send a cropped face, not the full frame

- The square crop comes from the landmark bounding box, padded 15% and clamped inside the frame.
- It shrinks the payload by more than an order of magnitude compared with a full 1280×720 frame. At 128×128 the measured crops were about 5.5 KB.
- The backend gets exactly what the model needs, with no face detector required on the server.

### 4. Smooth on the client with an exponential moving average

- Raw per-frame predictions flicker every time the user blinks or shifts slightly, so the bars show a moving average.
- It started as a fixed `0.7 × previous + 0.3 × new` per answer and was later made **time-based** (τ = 250 ms). The fixed version made the lag depend on how often answers arrived; see Decision 8.
- Smoothing resets when the model is switched, so the old model's answers don't bleed into the new one's.
- The bars stay in a **fixed order** instead of re-sorting biggest-first (this departs from the plan). When two scores are close, re-sorting makes rows jump around several times a second.

### 5. Replace FER+ with HSEmotion (EfficientNet-B0, AffectNet) as the default model

**Problem:** in real use, *happy* and *surprise* were detected reliably, but *sad*, *fear* and *disgust* were rarely detected.

**Diagnosis:**
- **Class imbalance in the training data.** FER+ is ~35k faces, with roughly 9k "happy" examples and only a few hundred each of "disgust" and "fear". The model learned the common classes well and the rare ones poorly.
- **Low input fidelity.** FER+ sees a 64×64 grayscale image. The cues that separate disgust and fear (nose wrinkle, upper-lip raise, eye widening) are small and get lost at that size.
- **Subtle real-world expressions.** Real fear and disgust are less exaggerated than a real smile.

**Options considered:**

| Option | Effort | Expected gain |
|---|---|---|
| Swap in a stronger pretrained model | ~1 hour | High: better data and higher resolution |
| Per-user calibration with MediaPipe's 52 blendshapes + a small classifier | ~½ day | High for the individual user |
| Fine-tune the FER+ CNN (PyTorch, licensed datasets, class-weighted loss) | Days | Limited by the small, low-resolution base model |

**Chosen:** swap to **HSEmotion EfficientNet-B0**, trained on AffectNet (~280k manually labeled in-the-wild faces, 224×224 colour). Per-user calibration is kept as a follow-up.

**How it was done safely:**
- The model's exact preprocessing was taken from the author's reference package source, not guessed: RGB order, 224 px resize, ImageNet mean/std normalisation, and its label order (which differs from FER+).
- A **model registry** maps each model's output order onto one canonical label order, so the frontend didn't change.
- All three models stay available behind a **live model picker**, so they can be compared on real faces instead of trusting one test image.
- The frontend crop was raised from 128 to 224 px to match the model's input.

**Benchmark (same face crop, laptop CPU):**

| Model | Input | Latency | Result on a broad smile |
|---|---|---|---|
| HSEmotion B0 | 224×224 RGB | ~6 ms | happiness 1.00 |
| HSEmotion B2 | 260×260 RGB | ~16 ms | happiness 0.36 / disgust 0.21 / contempt 0.18 |
| FER+ | 64×64 gray | ~7 ms | happiness 1.00 |

B0 became the default: same speed as FER+, far better training data, and correct on the test face. B2 was unexpectedly uncertain on an obvious smile, so it stays an option rather than the default.

### 6. Pin onnxruntime 1.20.1

The newest onnxruntime (1.31) crashed the Python process with a segfault **on import** on the development machine.

- **Root cause:** the machine's Microsoft Visual C++ runtime (14.34) is older than what recent onnxruntime builds need (14.40+).
- **Fix:** versions were bisected in an isolated throwaway virtualenv. 1.22.1 fails with a DLL init error; 1.20.1 and 1.19.2 work. The project pins 1.20.1 with a comment explaining why, plus a README troubleshooting entry.
- This was preferred over requiring a system-level runtime install from every contributor. Linux production is unaffected.

### 7. Deploy as one web service, not a static site + API

- **Options:** a static frontend plus a separate API service; one service; or a fully static app with in-browser inference (onnxruntime-web).
- **Chosen:** one Render web service. FastAPI serves the built React site at `/` and the API at `/ws` and `/health`.
- **Why:** same origin means no CORS and no environment-specific WebSocket URL, because the client already connects to `/ws` on whichever host served the page. It's one thing to deploy and one URL, and it keeps the Python backend as part of the project.
- **Details:**
  - `.wasm` is registered as `application/wasm`, which browsers require for streaming compilation.
  - API routes are defined before the static mount, so they always take priority.
  - The `EMOTION_MODELS` environment variable picks which models load (first = default). Production loads only B0, about 120 MB of RAM, to stay inside a 512 MB free instance.
  - `build.sh` installs a pinned Node if the Python build image's Node is missing or too old (Vite 8 requires ≥ 22.12).
- **Not chosen, for now:** the fully static version (better privacy, free hosting, no cold starts). It's documented as an alternative.

### 8. Fix production lag: time-based smoothing, pipelining, 1-thread inference, warm-up

**Problem:** deployed on Render's free plan, predictions were *correct* but the bars took a couple of seconds to settle on a new expression. Locally they felt instant.

**Diagnosis:** two effects multiplied together.
1. **Smoothing counted answers, not time.** Moving 30% per answer needs ~6–7 answers to get 90% of the way. At 8 answers/s that's ~0.8 s; at ~2 answers/s it's ~3 s.
2. **Production produced far fewer answers.** With one frame in flight, the rate is 1 / (network round trip + server time), and both grew in production:
   - The free instance has about **0.1 CPU**.
   - onnxruntime defaults to **one thread per visible core**. In a container it sees the host's cores, so many threads fight over a 0.1-CPU quota and get throttled.

**Fixes, each small and independent:**

| Fix | Change | Effect |
|---|---|---|
| Time-based smoothing | `amount = 1 − e^(−Δt/τ)`, τ = 250 ms | ~90% catch-up in ~0.6 s whatever the answer rate. Unit-tested: 2 answers 250 ms apart ≡ 8 answers 62.5 ms apart |
| Pipelining | Up to 2 frames in flight (FIFO, per-frame timeouts) | The next frame travels while the server works on the current one, hiding network latency |
| Single-thread inference | `intra_op_num_threads = 1`, sequential execution; `ONNX_THREADS` env var to override | Avoids thread contention on fractional-CPU containers |
| Warm-up | One dummy inference per model at startup | The first user's first frame doesn't pay one-time initialisation cost |

**Verification:** a throwaway harness wrapped the real app to add **100 ms of server time** and **150 ms of reply latency**. Under the same delays the new client reached **6.8 answers/s**, where the old one-in-flight design would be capped at about 3.5 answers/s (≈ 280 ms per answer).

**Trade-off noted:** on a laptop with real cores, one thread is slower (B0 ~19 ms vs ~6–9 ms) but still far within budget. That's why the thread count is a setting, not hard-coded.

---

## Problems found and fixed

### Frames were never sent, though the socket was "open"

- **Symptom:** the status showed *connected*, the mesh was drawing, but zero frames went to the server.
- **Root cause:** React 18+/19 StrictMode mounts effects twice in development. The first WebSocket was closed during cleanup, but its `onclose` fired *after* the second socket was created and set the shared `socketRef` to `null`. Every later send saw "no socket" and returned silently.
- **Fix:** a closing socket clears the ref only if it is still the current one (`if (socketRef.current === socket)`).
- **Lesson:** async callbacks from a torn-down effect must not mutate shared state unconditionally.

### Throughput capped at exactly 1 frame per second

- **Symptom:** the server answered in ~7 ms, yet only about one answer arrived per second instead of ~8.
- **Investigation:** `HTMLCanvasElement.toBlob` and `OffscreenCanvas.convertToBlob` were instrumented inside the page. **Both took ~1,030 ms every time.**
- **Root cause:** Chromium schedules these async image encoders in *idle time*, with a ~1 s deadline. The face-tracking `requestAnimationFrame` loop keeps the main thread busy every frame, so the page is never idle and each encode waits out the full deadline.
- **Fix:** encode synchronously with `canvas.toDataURL('image/jpeg')` (about a millisecond for a small crop) and convert to a `Blob`. A code comment records why, so it isn't "optimised" back.
- **Result:** 1 → 8 answers/s, with a ~25 ms send-to-receive round trip.

### Test harness: Edge rejected file-based fake cameras

- Chromium's `--use-file-for-fake-video-capture` returned `NotFoundError` for both `.y4m` and `.mjpeg` files.
- **Workaround:** the end-to-end scripts inject a fake `getUserMedia` that returns `canvas.captureStream()` playing a still face photo. This exercises the real app code path, including MediaPipe, cropping, the WebSocket and rendering, with no physical camera.

### WebSocket tests hung

- A test helper opened `TestClient` WebSocket sessions with `__enter__()` but never ran `__exit__`, leaving the test portal thread blocked. The fix was to rewrite the tests to use `with` blocks.

---

## Testing and verification

- **Backend (pytest, 38 tests):**
  - image decoding and bad input
  - FER+ and ImageNet preprocessing, including a channel-order test (BGR blue must land in the RGB blue channel)
  - numerically stable softmax
  - model output shape and probability sums, parametrised over every downloaded model
  - the WebSocket protocol: hello, inference, model switching, unknown model, bad image, bad command, connection staying open after errors
  - `EMOTION_MODELS` parsing
  - static site serving and WASM MIME type
- **Frontend (Vitest, 10 tests):** face-box geometry (square, padded, centred, clamped to the frame) and time-based smoothing, including a rate-independence property test.
- **End-to-end (Playwright + Edge, with a fake camera):**
  - landmarks drawn on the face
  - bars and badges update
  - the overlay label isn't mirrored
  - toggles and pause/resume (zero frames sent while paused)
  - model switching
  - reconnect after a backend restart (the page shows *disconnected*, then recovers to 8/s about a second after restart)
  - a 45-second stability run at a steady ~8/s
  - a phone-width layout check
- **Test-first:** each backend feature, plus the crop and smoothing logic, had failing tests written before the implementation.
- **Production rehearsal:** the built site and API ran from a single uvicorn process with only B0 loaded, and the full flow was checked in the browser. Memory was measured at ~119 MB.

---

## Measured results

| Metric | Value |
|---|---|
| Face landmarks | 478 points per frame, tracked live |
| Emotion update rate | ~8 per second per client (by design: 120 ms spacing, 1 in flight) |
| Round trip (send → reply) | ~25 ms on localhost |
| Model inference (CPU) | HSEmotion B0 ~6–10 ms · B2 ~16–18 ms · FER+ ~6 ms |
| Face crop payload | ~5.5 KB at 128×128 (crop size later raised to 224×224) |
| Server memory (B0 only) | ~119 MB |
| Throughput fix | 1 → 8 answers/s (Chromium idle-time encoder bottleneck) |
| Under simulated prod latency (100 ms server + 150 ms network) | 6.8 answers/s with pipelining, vs ~3.5/s one-in-flight |
| Smoothing catch-up | ~90% in ~0.6 s, independent of answer rate |

*Figures are from local runs on a Windows laptop, not production load tests.*

---

## Limitations (honest notes)

- **Accuracy not formally evaluated.** Model comparisons used one sample face plus informal live testing. There's no labelled test set or per-class accuracy report yet.
- **Expressions are not emotions.** The models classify facial expressions. Lighting, head angle and individual differences all affect results.
- **Single face** per frame in v1.
- **Render deployment** is configured and rehearsed locally, but `build.sh` has not yet run on Render's build image.
- **Free hosting cold starts:** a ~30–60 s wake-up after idle.

## Possible next steps

- **Per-user calibration ("train on me"):** record a few seconds of each expression, train a small classifier on MediaPipe's 52 blendshapes (for example, nose-sneer → disgust), and blend it with the CNN's output.
- **Evaluation harness:** per-class precision/recall for each model on a labelled set, such as RAF-DB (access by request).
- **Fully static variant:** run the ONNX model in the browser with onnxruntime-web, for no server cost and no data leaving the device.
- **Multi-face support** and an emotion-over-time chart.

---

## Resume bullets

Pick the 2–4 that fit the role.

- Built a **real-time facial emotion recognition web app** (React/TypeScript + FastAPI) that tracks a **478-point face mesh** in the browser and streams face crops over **WebSockets** to an **ONNX Runtime** inference service, delivering ~8 emotion predictions/s at ~25 ms round-trip latency.
- **Diagnosed a 1-frame-per-second throughput cap** by instrumenting the browser pipeline. Traced it to Chromium scheduling `toBlob`/`convertToBlob` encodes in idle time behind a busy `requestAnimationFrame` loop, and replaced them with synchronous encoding for an **8× throughput increase**.
- **Improved detection of under-represented emotions** (sad, fear, disgust) by replacing a FER+ model trained on a class-imbalanced ~35k-image set with an **EfficientNet-B0 trained on AffectNet** at matching latency (~6 ms CPU). Built a **model registry and live model switcher** to compare models on real input.
- Designed a **backpressure-aware streaming protocol**: bounded in-flight frames, rate limiting, reply timeouts, and auto-reconnect with exponential backoff, so slow inference lowers the update rate instead of growing latency.
- **Cut perceived production lag from seconds to ~0.6 s.** Diagnosed it as per-sample smoothing multiplied by low throughput on a 0.1-CPU host. Fixed it with time-based smoothing, request pipelining (**~2× throughput** under simulated latency), single-threaded ONNX inference to avoid CPU-quota contention, and model warm-up.
- Fixed a **React StrictMode race condition** in which a stale WebSocket's close handler cleared its replacement's reference, silently dropping every frame.
- Wrote **48 automated tests** (pytest + Vitest) test-first, plus **Playwright end-to-end checks** using a synthetic camera stream, covering the inference protocol, preprocessing correctness, reconnection and UI state.
- Packaged the app as a **single Render web service** using an infrastructure-as-code Blueprint. It serves the static frontend and WebSocket API from one origin, with configurable model loading to fit a 512 MB instance (~120 MB measured).

## Interview talking points

- **"Why not just send video to the server?"** Latency and bandwidth. Landmarks need camera frame rate, while emotions are fine at about 8 Hz. Crops are tiny compared with full frames.
- **"How did you find the 1 fps bug?"** Timestamps on every pipeline stage inside the page showed the encoder, not the network or the model, took about 1 s. Swapping `toBlob` for `convertToBlob` didn't help, which pointed to Chromium's idle-time scheduling rather than the specific API.
- **"How did you choose the new model?"** First the cause (class imbalance, 64 px grayscale input), then options ranked by effort and gain, then the reference preprocessing read from source, then a benchmark on identical input, then a live picker to validate on real faces.
- **"What would you do next?"** An evaluation harness with per-class metrics before tuning anything further, then per-user calibration on MediaPipe blendshapes.
