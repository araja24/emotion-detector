from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import mount_frontend


def make_dist(tmp_path):
    (tmp_path / "index.html").write_text("<!doctype html><title>Emotion Detector</title>")
    (tmp_path / "mediapipe").mkdir()
    (tmp_path / "mediapipe" / "engine.wasm").write_bytes(b"\0asm")
    return tmp_path


def test_serves_the_built_page_at_root(tmp_path):
    app = FastAPI()
    mount_frontend(app, make_dist(tmp_path))
    response = TestClient(app).get("/")
    assert response.status_code == 200
    assert "Emotion Detector" in response.text


def test_wasm_gets_the_right_content_type(tmp_path):
    # Browsers refuse to stream-compile WebAssembly served with the wrong type.
    app = FastAPI()
    mount_frontend(app, make_dist(tmp_path))
    response = TestClient(app).get("/mediapipe/engine.wasm")
    assert response.headers["content-type"] == "application/wasm"


def test_api_routes_still_win_over_the_site(tmp_path):
    app = FastAPI()

    @app.get("/health")
    def health():
        return {"ok": True}

    mount_frontend(app, make_dist(tmp_path))
    assert TestClient(app).get("/health").json() == {"ok": True}


def test_missing_build_folder_is_skipped_quietly(tmp_path):
    app = FastAPI()
    assert mount_frontend(app, tmp_path / "does-not-exist") is False
