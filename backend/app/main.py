"""The backend "kitchen": a FastAPI app the React frontend talks to."""

import json
import mimetypes
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from app.emotion_model import EmotionModel, load_available_models, parse_model_ids
from app.preprocess import InvalidImageError, decode_image

# The built React site (`npm run build`). Served by this app in production so the
# page and /ws share one address; in development Vite serves the page instead.
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the models once at startup, not once per picture.
    # EMOTION_MODELS (e.g. "hsemotion-b0") limits which ones, to save memory on small servers.
    app.state.models = load_available_models(parse_model_ids(os.environ.get("EMOTION_MODELS")))
    yield


app = FastAPI(title="Emotion Detector API", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, bool]:
    """Tiny check that the server is alive."""
    return {"ok": True}


def analyse(model: EmotionModel, image: np.ndarray) -> dict:
    started = time.perf_counter()
    emotions = model.predict(image)
    return {
        "emotions": emotions,
        "top": max(emotions, key=emotions.get),
        "ms": round((time.perf_counter() - started) * 1000, 1),
    }


@app.websocket("/ws")
async def emotions_socket(websocket: WebSocket):
    """
    Binary message = a face picture (JPEG/PNG) -> reply with emotion confidences.
    Text message   = a command; {"model": "<id>"} switches model for this connection.
    On connect the server says hello with the list of models and which one is active.
    """
    await websocket.accept()
    models: dict[str, EmotionModel] = websocket.app.state.models
    model_id = next(iter(models))  # the first loaded model is the default
    await websocket.send_json(
        {"models": [{"id": i, "name": m.spec.name} for i, m in models.items()], "model": model_id}
    )
    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break

            data = message.get("bytes")
            if data is None:
                try:
                    command = json.loads(message.get("text") or "")
                except json.JSONDecodeError:
                    command = None
                if not isinstance(command, dict) or "model" not in command:
                    await websocket.send_json({"error": "bad_command"})
                elif command["model"] not in models:
                    await websocket.send_json({"error": "unknown_model"})
                else:
                    model_id = command["model"]
                    await websocket.send_json({"model": model_id})
                continue

            try:
                image = decode_image(data)
            except InvalidImageError:
                await websocket.send_json({"error": "bad_image"})
                continue
            # The model is CPU work; run it off the event loop so other connections stay snappy.
            reply = await run_in_threadpool(analyse, models[model_id], image)
            await websocket.send_json({**reply, "model": model_id})
    except WebSocketDisconnect:
        pass


def mount_frontend(app: FastAPI, dist: Path) -> bool:
    """Serve the built website at "/". Routes defined earlier (/health, /ws) still take priority."""
    if not (dist / "index.html").exists():
        return False
    # Browsers only stream-compile WebAssembly (MediaPipe's engine) when it has this exact type.
    mimetypes.add_type("application/wasm", ".wasm")
    app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
    return True


mount_frontend(app, FRONTEND_DIST)
