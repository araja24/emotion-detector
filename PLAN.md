# PLAN.md: Real-Time Face Emotion Detector

---

## 0. What are we building? (the baby version)

You open a web page. It asks to use your camera. You say yes.

Now you see **yourself** on the screen. On top of your face there are **little glowing dots** (we call them *nodes* or *landmarks*): on your eyebrows, around your eyes, your nose, your lips, your jaw.

Next to the video there is a **list of feelings** with bars that move:

```
😀 Happy     ████████████████░░░░  82%
😐 Neutral   ███░░░░░░░░░░░░░░░░░  11%
😮 Surprise  █░░░░░░░░░░░░░░░░░░░   4%
😢 Sad       ░░░░░░░░░░░░░░░░░░░░   1%
😠 Angry     ░░░░░░░░░░░░░░░░░░░░   1%
🤢 Disgust   ░░░░░░░░░░░░░░░░░░░░   0%
😨 Fear      ░░░░░░░░░░░░░░░░░░░░   1%
😏 Contempt  ░░░░░░░░░░░░░░░░░░░░   0%
```

Smile → the "Happy" bar grows. Frown → "Sad" or "Angry" grows. That number is how **sure** the computer is. It happens **live**, many times a second.

---

## 1. The big picture (who does what)

Think of it like a restaurant:

- **The browser (React + Vite)** is the **waiter**. It talks to you, shows you things, and carries stuff to the kitchen.
- **The backend (Python + FastAPI)** is the **kitchen**. It does the heavy "thinking" (deciding which feeling your face shows).
- **The WebSocket** is the **little window between the waiter and the kitchen**. Instead of walking back and forth (normal web requests), they just pass plates through the window very fast, nonstop.

```
 ┌──────────────── YOUR BROWSER (React + Vite) ────────────────┐
 │                                                             │
 │  📷 Camera ──► <video>                                      │
 │                  │                                          │
 │                  ├──► MediaPipe Face Landmarker             │
 │                  │      (finds 478 dots on your face,       │
 │                  │       ~30 times a second)                │
 │                  │            │                             │
 │                  │            ├──► <canvas> draws the dots  │
 │                  │            │                             │
 │                  │            └──► box around the face      │
 │                  │                       │                  │
 │                  └──► cut out just the face (small picture) │
 │                                          │                  │
 └──────────────────────────────────────────┼──────────────────┘
                                            │  WebSocket
                                            ▼  (~8 face pictures / second)
 ┌──────────────── BACKEND (Python + FastAPI) ─────────────────┐
 │  1. open the picture                                        │
 │  2. make it gray + tiny (64×64)                             │
 │  3. ask the emotion brain (FER+ ONNX model)                 │
 │  4. turn its answer into percentages (softmax)              │
 │  5. send back: {"happy":0.82,"neutral":0.11, ...}           │
 └─────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
                   React shows the moving confidence bars
```

### Why split it like this?

- **Dots in the browser:** dots must move *perfectly smoothly* with your face (30+ times a second). Sending every frame to a server and waiting for an answer would make the dots laggy. MediaPipe runs right in the browser, fast, using your graphics card.
- **Feelings in the backend:** this is the "brain" part. Python is the best language for AI models, and it lets us swap in a better brain later without touching the website. Feelings don't need to update 30 times a second. 8 times a second already looks live.

---

## 2. The tools we picked (and what each one is, simply)

| Tool | What it is, like you're 5 | Why we picked it |
|---|---|---|
| **React** | LEGO blocks for building web pages | You asked for it; great for live-updating screens |
| **Vite** | The super-fast machine that builds and serves the LEGO page while you work | You asked for it; starts instantly |
| **TypeScript** | JavaScript with labels on every box so you don't mix things up | Catches mistakes before they happen |
| **MediaPipe Face Landmarker** (`@mediapipe/tasks-vision`) | A Google robot eye that finds 478 points on a face | Free, fast, runs in the browser |
| **Python 3.11** | A friendly programming language that AI people love | Best home for AI models |
| **FastAPI** | A tiny, fast Python "kitchen" that can receive orders | Easy, modern, built-in WebSocket support |
| **Uvicorn** | The stove that keeps the FastAPI kitchen running | The standard way to run FastAPI |
| **ONNX Runtime** | A machine that can run a pre-trained AI brain | Fast on a normal laptop CPU, no GPU needed |
| **FER+ model** (`emotion-ferplus-8.onnx`) | A pre-trained brain that already learned 8 feelings from ~35,000 face photos | Free, small (~34 MB), no training needed by us |
| **OpenCV / NumPy** | Picture-scissors and a calculator for pictures | Resize/gray-ify the face picture |
| **WebSocket** | A phone call that stays open instead of sending letters | Fast, nonstop back-and-forth |

---

## 3. Folder layout (where every file lives)

```
emotion-detector/
├── PLAN.md                     ← this file
├── README.md                   ← how to run it
│
├── frontend/                   ← the waiter (React + Vite)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts          ← tells Vite to forward /ws to the backend
│   ├── public/
│   │   └── models/face_landmarker.task   ← MediaPipe's face-dot brain file
│   └── src/
│       ├── main.tsx            ← starts React
│       ├── App.tsx             ← the whole page layout
│       ├── hooks/
│       │   ├── useCamera.ts          ← turns the camera on/off
│       │   ├── useFaceLandmarker.ts  ← finds the 478 dots each frame
│       │   └── useEmotionSocket.ts   ← talks to the backend
│       ├── components/
│       │   ├── CameraView.tsx        ← <video> + <canvas> stacked on top
│       │   ├── EmotionBars.tsx       ← the moving % bars
│       │   └── StatusBadge.tsx       ← "camera on / backend connected / no face"
│       ├── lib/
│       │   ├── drawLandmarks.ts      ← paints dots + lines on the canvas
│       │   ├── cropFace.ts           ← cuts the face out of the video
│       │   └── smoothing.ts          ← stops the bars from jittering
│       └── styles.css
│
└── backend/                    ← the kitchen (Python + FastAPI)
    ├── requirements.txt
    ├── models/
    │   └── emotion-ferplus-8.onnx    ← the feelings brain
    ├── app/
    │   ├── main.py             ← makes the FastAPI app + the /ws door + /health
    │   ├── emotion_model.py    ← loads the brain once, answers "what feeling?"
    │   └── preprocess.py       ← turns a picture into what the brain wants
    └── tests/
        ├── test_preprocess.py
        └── test_emotion_model.py
```

---

## 4. How it works, step by step (the life of one frame)

### Step 1: Turn on the camera 📷
`useCamera.ts` calls `navigator.mediaDevices.getUserMedia({ video: true })`.
The browser pops up "Allow camera?". If yes, we get a live video stream and plug it into a `<video>` tag.

> 🍼 Browsers only allow cameras on `https://` or on `localhost`. Since we develop on `localhost`, it just works.

### Step 2: Find the face dots 🔵
`useFaceLandmarker.ts` loads MediaPipe once. Then, on every screen refresh (`requestAnimationFrame`, ~60 times/sec), it hands the current video frame to MediaPipe and gets back **478 points**, each with an `x` and `y` between 0 and 1 (0 = left/top edge, 1 = right/bottom edge).

### Step 3: Draw the dots 🎨
`drawLandmarks.ts` draws on a transparent `<canvas>` sitting exactly on top of the `<video>` (like a clear sticker sheet over a photo).
- Multiply each `x` by the canvas width and `y` by the height → that's where the dot goes.
- Draw small dots for all points, and thin lines along the eyebrows, eyes, lips and face outline (MediaPipe gives us these line lists: `FaceLandmarker.FACE_LANDMARKS_LIPS`, etc.), so it looks like a cool face mesh.
- The video is mirrored (`transform: scaleX(-1)`) so it feels like a mirror; the canvas is mirrored the same way so dots line up.

### Step 4: Cut out the face ✂️
`cropFace.ts` finds the smallest/largest `x` and `y` of all the dots → that's a box around your face. Make the box a bit bigger (+15%) and square, then copy just that part of the video onto a small hidden canvas (128×128) and turn it into a JPEG.

> 🍼 Why only the face? Sending a tiny face picture (~4 KB) is much faster than the whole camera picture (~100 KB+), and the brain only needs the face anyway.

### Step 5: Send it to the kitchen 📨
`useEmotionSocket.ts` keeps one WebSocket open to `ws://localhost:5173/ws` (Vite forwards it to the backend on port 8000).
- At most **one picture every ~120 ms** (about 8 per second).
- **Never send a new one while still waiting** for the last answer. This stops a traffic jam if the backend is slow ("one plate in the window at a time").
- If no face is found, send nothing and show "No face found 👀".

### Step 6: The kitchen thinks 🧠 (backend)
`main.py` has a WebSocket door at `/ws`. For every picture it receives:
1. `preprocess.py`: decode JPEG → make it **gray** → shrink to **64×64** → shape it as `[1, 1, 64, 64]` (that is the exact shape the FER+ brain was trained on).
2. `emotion_model.py`: run the brain with ONNX Runtime → get **8 raw scores** (big numbers, not percentages yet).
3. **Softmax**: a math trick that turns raw scores into percentages that add up to 100%.
   > 🍼 Softmax is like sharing 100 candies among 8 kids: the kid with the biggest score gets the most candies, but every kid gets at least a crumb.
4. Send back JSON:
   ```json
   { "emotions": { "neutral": 0.11, "happiness": 0.82, "surprise": 0.04, "sadness": 0.01,
                   "anger": 0.01, "disgust": 0.00, "fear": 0.01, "contempt": 0.00 },
     "top": "happiness", "ms": 6 }
   ```
The brain is loaded **once** when the server starts (not once per picture), so each answer takes only a few milliseconds.

### Step 7: Show the feelings 📊
`EmotionBars.tsx` shows 8 bars sorted biggest-first, with the emoji, name and `%`. The top feeling is highlighted, and its name is also written above the face on the canvas.

`smoothing.ts` mixes the new answer with the old one (`shown = 0.7 × old + 0.3 × new`, called an *exponential moving average*).
> 🍼 Without this, the bars would twitch like a nervous bunny every time you blink. Smoothing makes them glide.

---

## 5. Build order (do these in this order)

Each milestone ends with something you can **see working**.

### Milestone 1: Project skeleton
- `npm create vite@latest frontend -- --template react-ts`, then `npm install @mediapipe/tasks-vision`.
- `backend/`: create a Python virtual environment (`python -m venv .venv`), then install `fastapi uvicorn[standard] onnxruntime opencv-python-headless numpy pytest`.
- Add `GET /health` → `{"ok": true}`.
- ✅ See it: `npm run dev` shows the Vite page; `http://localhost:8000/health` shows `{"ok": true}`.

### Milestone 2: Camera on screen
- `useCamera.ts` + `CameraView.tsx`. Handle "user said no" and "no camera" with a friendly message.
- ✅ See it: you see yourself, mirrored.

### Milestone 3: Face dots
- Download `face_landmarker.task` into `public/models/`.
- `useFaceLandmarker.ts` (running mode `"VIDEO"`, `numFaces: 1`, GPU delegate) + `drawLandmarks.ts`.
- ✅ See it: dots and lines stick to your face as you move.

### Milestone 4: The feelings brain (backend only)
- Download `emotion-ferplus-8.onnx` (from the ONNX Model Zoo) into `backend/models/`.
- Write `preprocess.py` and `emotion_model.py` with the labels in this exact order:
  `neutral, happiness, surprise, sadness, anger, disgust, fear, contempt`.
- Write tests first (see §7), then make them pass.
- ✅ See it: `pytest` is green.

### Milestone 5: Connect waiter and kitchen
- `/ws` endpoint in `main.py`; `cropFace.ts` + `useEmotionSocket.ts` in the frontend; Vite proxy for `/ws` → `http://localhost:8000` with `ws: true`.
- Auto-reconnect if the backend restarts (try again after 1s, 2s, 4s…).
- ✅ See it: browser DevTools → Network → WS shows messages going back and forth.

### Milestone 6: The confidence bars
- `EmotionBars.tsx`, `smoothing.ts`, `StatusBadge.tsx`, top emotion label on the canvas.
- ✅ See it: smile → Happy goes up; open your mouth wide → Surprise goes up.

### Milestone 7: Polish
- Toggle buttons: show/hide dots, show/hide lines, pause camera.
- Small FPS counter (dots FPS + emotion answers/sec).
- Nice look: dark background, glowing cyan dots, smooth bar animation (`transition: width 150ms`).
- `README.md` with "how to run" in 2 commands.

---

## 6. Important little rules (so nothing breaks)

- **Privacy:** pictures are never saved to disk; the backend only looks at each face for a few milliseconds and forgets it. Say this on the page.
- **One face only** for version 1 (`numFaces: 1`). Easy to raise later.
- **Backpressure:** never more than 1 picture "in flight" at once (Step 5).
- **Model loaded once** at startup (FastAPI `lifespan`), not per request.
- **Bad input is OK:** if a picture can't be decoded, the backend replies `{"error": "bad_image"}` and keeps the connection open instead of crashing.
- **Clean up:** when the page closes, stop the camera tracks, close the WebSocket and the MediaPipe landmarker (otherwise the camera light stays on).
- **Honesty about accuracy:** AI emotion guessing is not mind-reading. It guesses from *facial expressions*, works best with good light and a face looking at the camera, and can be wrong. Show a small note on the page.

---

## 7. How we check it works (testing)

**Backend (automatic, `pytest`):**
- `test_preprocess.py`: any-size color JPEG in → array of shape `(1, 1, 64, 64)`, type `float32`.
- `test_emotion_model.py`: on a sample face picture, returns all 8 labels, each between 0 and 1, adding up to ~1.0.
- WebSocket test with FastAPI's `TestClient`: send a JPEG → get JSON with `emotions`; send garbage bytes → get `{"error": "bad_image"}` and connection stays open.

**Frontend (automatic, `vitest`):**
- `smoothing.ts`: mixing old + new gives the expected numbers.
- `cropFace.ts` box math: dots in → correct square box out, clamped inside the video edges.

**By hand (end to end):**
1. Terminal 1: `cd backend && uvicorn app.main:app --reload --port 8000`
2. Terminal 2: `cd frontend && npm run dev` → open `http://localhost:5173`
3. Allow the camera → dots appear on your face and follow you.
4. Smile big → **Happy** becomes the top bar. Raise eyebrows + open mouth → **Surprise**. Relax → **Neutral**.
5. Cover your face with your hand → "No face found 👀", bars freeze.
6. Stop the backend → badge says "Backend disconnected"; start it again → it reconnects by itself.
7. Watch the FPS counter: dots ≥ 25 FPS, emotions ≈ 8 answers/sec.

---

## 8. Later ideas (not in version 1)

- Multiple faces at once.
- Better emotion brain (e.g. HSEmotion EfficientNet ONNX): swap the file in `backend/models/` + the labels list.
- A little chart of your feelings over the last 30 seconds.
- Deploy: frontend on any static host, backend in a Docker container (must use `https://`/`wss://` for the camera to work).

---

## 9. Tiny dictionary 📖

- **Frontend**: the part you see in the browser.
- **Backend**: the part on a server you don't see that does work for the frontend.
- **Landmark / node**: one dot on a special spot of your face (tip of nose, corner of mouth…).
- **Model**: a computer brain that already learned something from lots of examples.
- **ONNX**: a common file format for these brains so any program can run them.
- **Inference**: asking the brain a question and getting an answer.
- **Confidence**: how sure the brain is, from 0% (no idea) to 100% (totally sure).
- **Softmax**: the math that turns raw brain scores into percentages that add up to 100%.
- **WebSocket**: an always-open phone line between browser and server.
- **FPS**: frames per second: how many times per second something updates.

