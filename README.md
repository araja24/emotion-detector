# Emotion Detector

Real-time facial emotion detection in the browser, with a mood-reactive UI ("one light per mood", designed in Claude Design as *Mien*). Turn on your webcam and the app:

- draws **478 face landmarks** (dots + mesh) on your face, live, ~30 FPS
- shows how confident it is that you look **neutral, happy, surprised, sad, angry, disgusted, fearful or contemptuous**, about 8 times a second

The design and a plain-English walkthrough of how it works are in [PLAN.md](PLAN.md).

```
Browser (React + Vite)                          Backend (Python + FastAPI)
  camera ─► MediaPipe Face Landmarker             /ws  ◄── 224×224 face JPEG
          ├─► canvas: dots, mesh, label                ─► 224×224 RGB ─► HSEmotion ONNX model
          └─► crop face ──── WebSocket ─────────►      ─► softmax ─► {"emotions": {...}}
  bars ◄── smoothing ◄───────────────────────────────────────────────┘
```

## Run it

You need **Node.js 22.12+** and **Python 3.11+**. Use two terminals.

**1. Backend** (port 8000)

```bash
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements-dev.txt      # macOS/Linux: .venv/bin/pip
.venv\Scripts\python -m app.download_models            # the default emotion model (~16 MB)
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

**2. Frontend** (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**, click **Start camera** and allow access.

Optional: download the other models to compare them in the app's **Model** picker:

```bash
.venv\Scripts\python -m app.download_models all
```

The first four backend lines and `npm install` are one-time setup. After that it's just the `uvicorn` command and `npm run dev`. `npm run dev` also copies MediaPipe's runtime into `public/` and downloads the face landmark model (~4 MB) the first time.

## Using it

| Control | What it does |
|---|---|
| **Start / Stop camera** | Turns the webcam on/off (the camera light goes off too). |
| **Pause / Resume** | Freezes the picture and the analysis; the reading stays on screen. |
| **Dots** / **Mesh** | Show or hide the 478 landmark dots / the face mesh and feature contours. |
| **Model** | *Balanced* (HSEmotion B0), *Large* (B2), *Classic* (FER+). Only shown when more than one is loaded. |
| **Retry now** | Shown when the backend is unreachable. Reconnects immediately instead of waiting for the countdown. |
| Status pills | Camera, Face (found / not found) and Backend (connected / connecting / disconnected). |

The leading emotion's colour tints the page aura, the stage rim, the logo, the face contours and the floating label. **Right now** shows the big reading, real reads/second and a one-line description. **Last 10 seconds** is a strip of which emotion led, sampled 4× a second. The stage shows real FPS and real send→answer latency.

The backend can be stopped and restarted at any time. The page reconnects by itself.

Tips: face the camera, use even lighting, and exaggerate a little. The model reads facial *expressions*, not feelings, and it can be wrong.

## Emotion models

| Model | Trained on | Input | Speed* | Notes |
|---|---|---|---|---|
| **HSEmotion B0** (default) | AffectNet (~280k real-world faces) | 224×224 colour | ~6–10 ms | Best balance; much better than FER+ at sad / fear / disgust |
| HSEmotion B2 | AffectNet | 260×260 colour | ~16–18 ms | Bigger network, softer (less extreme) percentages |
| FER+ | FER2013 relabelled (~35k faces) | 64×64 gray | ~6 ms | Original model; strong on happy / surprise, weak on rare emotions |

*per picture on a laptop CPU. All three answer with the same 8 emotions.

## Deploy (Render)

The whole app deploys as **one web service**. FastAPI serves the built React site and the `/ws` WebSocket from the same address, so there's no CORS setup and no separate static site.

1. Push this folder to a GitHub (or GitLab/Bitbucket) repo.
2. In the [Render Dashboard](https://dashboard.render.com): **New → Blueprint**, then connect the repo. Render reads [`render.yaml`](render.yaml).
3. Click **Deploy Blueprint**. The first build takes a few minutes. Then open the `https://….onrender.com` URL.

What happens:

- **Build** ([`build.sh`](build.sh)): installs Python packages, installs Node if needed, runs `npm ci && npm run build` (which also fetches MediaPipe's files), and downloads the emotion model(s).
- **Start:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Health check: `/health`.
- **`EMOTION_MODELS`** (in `render.yaml`) picks which models load. The first one is the default. It's set to `hsemotion-b0`, which uses about 120 MB of RAM, to fit the free plan's 512 MB. To get the model picker on a paid plan, use `hsemotion-b0,hsemotion-b2,ferplus`.
- **HTTPS** is automatic on Render, which the camera requires. The page switches to `wss://` by itself.
- **`ONNX_THREADS`** (default `1`) sets threads per model. Keep it at 1 on fractional-CPU plans, where extra threads just fight over the CPU share. Try 2 or more only with whole cores.
- **Free plan:** the service sleeps after ~15 minutes idle. The next visit takes ~30–60 s to wake it. It also has only ~0.1 CPU, so expect fewer emotion updates per second than locally. The bars stay responsive because smoothing is time-based and up to 2 frames are pipelined.

To rehearse production locally, run `npm run build` in `frontend/`, then start `uvicorn` in `backend/` without Vite and open http://localhost:8000.

## Privacy

Video stays in the browser. Only small face crops are sent to the app's server, where each crop is analysed in memory and then discarded. Nothing is saved to disk.

## Tests

```bash
cd backend  && .venv\Scripts\python -m pytest     # preprocessing, models, WebSocket
cd frontend && npm test                            # face-box math, smoothing (vitest)
```

## Project layout

```
render.yaml              Render Blueprint (one web service)
build.sh                 Render build script
backend/
  app/main.py            FastAPI app: GET /health, WebSocket /ws, serves frontend/dist
  app/download_models.py downloads model files (python -m app.download_models [all|ids])
  app/preprocess.py      picture bytes -> each model's input tensor
  app/emotion_model.py   model registry (HSEmotion B0/B2, FER+) + softmax
  models/                *.onnx model files (downloaded, not in git)
frontend/
  src/App.tsx            wires everything together
  src/hooks/             useCamera, useFaceLandmarker, useEmotionSocket
  src/components/        Header, Stage, ControlBar, Readout, icons
  src/lib/               drawLandmarks, cropFace, smoothing, emotions, stage (label maths), trail
  scripts/setup-assets.mjs  copies MediaPipe wasm + downloads the landmark model
```

## Troubleshooting

- **Python crashes on `import onnxruntime` (Windows).** Newer onnxruntime builds need Microsoft Visual C++ Runtime 14.40+. This project pins `onnxruntime==1.20.1`, which works with older runtimes. To use a newer onnxruntime, install the latest *Microsoft Visual C++ Redistributable (x64)* first.
- **"Emotion model not found".** Run `.venv\Scripts\python -m app.download_models` inside `backend/`.
- **"Camera permission was blocked".** Click the camera icon in the address bar, allow access, then press *Try again*. Browsers only allow cameras on `localhost` or `https://`.
- **Backend pill says "disconnected".** Start the backend on port 8000. The page reconnects automatically.
- **Dots but no bars.** Check that the backend terminal shows `WebSocket /ws [accepted]`.

## Credits

- Face landmarks: [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) (Apache 2.0)
- Emotion models: [HSEmotion](https://github.com/av-savchenko/face-emotion-recognition) by Andrey Savchenko (Apache 2.0)
- [FER+ (emotion-ferplus-8)](https://github.com/onnx/models/tree/main/validated/vision/body_analysis/emotion_ferplus) from the ONNX Model Zoo (MIT)
