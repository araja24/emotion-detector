"""The backend "kitchen": a FastAPI app the React frontend talks to."""

import json
import time
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool

from app.emotion_model import DEFAULT_MODEL_ID, EmotionModel, load_available_models
from app.preprocess import InvalidImageError, decode_image


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the models once at startup — not once per picture.
    app.state.models = load_available_models()
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
    model_id = DEFAULT_MODEL_ID
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
