# Emotion Detector

Real-time facial emotion detection in the browser. Turn on your webcam and the app:

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

You need **Node.js 20+** and **Python 3.11+**. Use two terminals.

**1. Backend** (port 8000)

```bash
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt          # macOS/Linux: .venv/bin/pip
curl -L -o models/enet_b0_8_best_vgaf.onnx https://github.com/av-savchenko/face-emotion-recognition/raw/main/models/affectnet_emotions/onnx/enet_b0_8_best_vgaf.onnx
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

**2. Frontend** (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**, click **Start camera** and allow access.

Optional extra models to compare in the app's **Model** picker (download any of them into `backend/models/`):

```bash
curl -L -o models/enet_b2_8.onnx https://github.com/av-savchenko/face-emotion-recognition/raw/main/models/affectnet_emotions/onnx/enet_b2_8.onnx
curl -L -o models/emotion-ferplus-8.onnx https://github.com/onnx/models/raw/main/validated/vision/body_analysis/emotion_ferplus/model/emotion-ferplus-8.onnx
```

The first four backend lines and `npm install` are one-time setup. After that it's just the `uvicorn` command and `npm run dev`. `npm run dev` also copies MediaPipe's runtime into `public/` and downloads the face landmark model (~4 MB) the first time.

## Using it

| Control | What it does |
|---|---|
| **Start / Stop camera** | Turns the webcam on/off (the camera light goes off too). |
| **Dots** / **Lines** | Show or hide the 478 landmark dots / the face mesh and contours. |
| **Model** | Switch emotion model live (only shown when more than one is downloaded). |
| **Pause / Resume** | Freezes the picture and the analysis; the bars keep the last reading. |
| Status pills | Camera, Face (found / not found) and Backend (connected / disconnected). |

The backend can be stopped and restarted at any time. The page reconnects by itself.

Tips: face the camera, use even lighting, and exaggerate a little. The model reads facial *expressions*, not feelings, and it can be wrong.

## Emotion models

| Model | Trained on | Input | Speed* | Notes |
|---|---|---|---|---|
| **HSEmotion B0** (default) | AffectNet (~280k real-world faces) | 224×224 colour | ~6–10 ms | Best balance; much better than FER+ at sad / fear / disgust |
| HSEmotion B2 | AffectNet | 260×260 colour | ~16–18 ms | Bigger network, softer (less extreme) percentages |
| FER+ | FER2013 relabelled (~35k faces) | 64×64 gray | ~6 ms | Original model; strong on happy / surprise, weak on rare emotions |

*per picture on a laptop CPU. All three answer with the same 8 emotions.

## Privacy

Video stays in your browser. Only small face crops are sent, to your own local backend. Each crop is analysed in memory and then discarded. Nothing is saved to disk.

## Tests

```bash
cd backend  && .venv\Scripts\python -m pytest     # preprocessing, models, WebSocket
cd frontend && npm test                            # face-box math, smoothing (vitest)
```

## Project layout

```
backend/
  app/main.py            FastAPI app: GET /health, WebSocket /ws
  app/preprocess.py      picture bytes -> each model's input tensor
  app/emotion_model.py   model registry (HSEmotion B0/B2, FER+) + softmax
  models/                *.onnx model files (downloaded, not in git)
frontend/
  src/App.tsx            wires everything together
  src/hooks/             useCamera, useFaceLandmarker, useEmotionSocket
  src/components/        CameraView, Controls, EmotionBars, StatusBadge
  src/lib/               drawLandmarks, cropFace, smoothing, emotions
  scripts/setup-assets.mjs  copies MediaPipe wasm + downloads the landmark model
```

## Troubleshooting

- **Python crashes on `import onnxruntime` (Windows).** Newer onnxruntime builds need Microsoft Visual C++ Runtime 14.40+. This project pins `onnxruntime==1.20.1`, which works with older runtimes. To use a newer onnxruntime, install the latest *Microsoft Visual C++ Redistributable (x64)* first.
- **"Emotion model not found".** Run the HSEmotion B0 `curl` line from step 1 inside `backend/`. It's the only required model.
- **"Camera permission was blocked".** Click the camera icon in the address bar, allow access, then press *Try again*. Browsers only allow cameras on `localhost` or `https://`.
- **Backend pill says "disconnected".** Start the backend on port 8000. The page reconnects automatically.
- **Dots but no bars.** Check that the backend terminal shows `WebSocket /ws [accepted]`.

## Credits

- Face landmarks: [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) (Apache 2.0)
- Emotion models: [HSEmotion](https://github.com/av-savchenko/face-emotion-recognition) by Andrey Savchenko (Apache 2.0)
- [FER+ (emotion-ferplus-8)](https://github.com/onnx/models/tree/main/validated/vision/body_analysis/emotion_ferplus) from the ONNX Model Zoo (MIT)
