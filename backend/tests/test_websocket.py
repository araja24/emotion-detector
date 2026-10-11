import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.emotion_model import DEFAULT_MODEL_ID, LABELS, MODEL_SPECS
from app.main import app

pytestmark = pytest.mark.skipif(
    not MODEL_SPECS[DEFAULT_MODEL_ID].path.exists(), reason="default model file not downloaded"
)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:  # `with` runs startup, which loads the models
        yield c


def jpeg_bytes() -> bytes:
    image = np.random.default_rng(2).integers(0, 256, (128, 128, 3), dtype=np.uint8)
    return cv2.imencode(".jpg", image)[1].tobytes()


def test_hello_lists_models_and_says_which_is_active(client):
    with client.websocket_connect("/ws") as ws:
        hello = ws.receive_json()
    assert hello["model"] == DEFAULT_MODEL_ID
    ids = [m["id"] for m in hello["models"]]
    assert DEFAULT_MODEL_ID in ids
    assert all({"id", "name"} <= set(m) for m in hello["models"])


def test_picture_in_emotions_out(client):
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()  # hello
        ws.send_bytes(jpeg_bytes())
        reply = ws.receive_json()
    assert tuple(reply["emotions"]) == LABELS
    assert sum(reply["emotions"].values()) == pytest.approx(1.0, abs=1e-5)
    assert reply["top"] == max(reply["emotions"], key=reply["emotions"].get)
    assert reply["model"] == DEFAULT_MODEL_ID
    assert reply["ms"] >= 0


def test_switching_model(client):
    with client.websocket_connect("/ws") as ws:
        hello = ws.receive_json()
        other = next((m["id"] for m in hello["models"] if m["id"] != DEFAULT_MODEL_ID), None)
        if other is None:
            pytest.skip("only one model downloaded")
        ws.send_json({"model": other})
        assert ws.receive_json() == {"model": other}
        ws.send_bytes(jpeg_bytes())
        assert ws.receive_json()["model"] == other


def test_unknown_model_is_refused_and_connection_stays_open(client):
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()  # hello
        ws.send_json({"model": "nope"})
        assert ws.receive_json() == {"error": "unknown_model"}
        ws.send_bytes(jpeg_bytes())
        assert ws.receive_json()["model"] == DEFAULT_MODEL_ID


def test_garbage_gets_bad_image_and_connection_stays_open(client):
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()  # hello
        ws.send_bytes(b"not a picture")
        assert ws.receive_json() == {"error": "bad_image"}
        ws.send_bytes(jpeg_bytes())
        assert "emotions" in ws.receive_json()


def test_text_that_is_not_a_command_is_rejected_politely(client):
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()  # hello
        ws.send_text("hello")
        assert ws.receive_json() == {"error": "bad_command"}
        ws.send_bytes(jpeg_bytes())
        assert "emotions" in ws.receive_json()
