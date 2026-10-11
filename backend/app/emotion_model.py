"""The "feelings brains": ONNX emotion models that return a confidence per emotion.

Three models are supported; any whose file is in models/ gets loaded:
  hsemotion-b0  EfficientNet-B0 trained on AffectNet (default: accurate and fast)
  hsemotion-b2  EfficientNet-B2 trained on AffectNet (bigger, slower)
  ferplus       the original small FER+ network (64x64 gray)
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import numpy as np
import onnxruntime as ort

from app.preprocess import ferplus_tensor, imagenet_tensor

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

# The order the frontend shows them in. Every model's answer is re-ordered to this.
LABELS = ("neutral", "happiness", "surprise", "sadness", "anger", "disgust", "fear", "contempt")

_HSEMOTION_LABELS = ("anger", "contempt", "disgust", "fear", "happiness", "neutral", "sadness", "surprise")
_HSEMOTION_URL = "https://github.com/av-savchenko/face-emotion-recognition/raw/main/models/affectnet_emotions/onnx/"


@dataclass(frozen=True)
class ModelSpec:
    name: str
    filename: str
    url: str
    output_labels: tuple[str, ...]  # what each of the model's outputs means, in its own order
    to_tensor: Callable[[np.ndarray], np.ndarray]

    @property
    def path(self) -> Path:
        return MODELS_DIR / self.filename


MODEL_SPECS: dict[str, ModelSpec] = {
    "hsemotion-b0": ModelSpec(
        name="HSEmotion B0 (fast, recommended)",
        filename="enet_b0_8_best_vgaf.onnx",
        url=_HSEMOTION_URL + "enet_b0_8_best_vgaf.onnx",
        output_labels=_HSEMOTION_LABELS,
        to_tensor=lambda image: imagenet_tensor(image, 224),
    ),
    "hsemotion-b2": ModelSpec(
        name="HSEmotion B2 (bigger)",
        filename="enet_b2_8.onnx",
        url=_HSEMOTION_URL + "enet_b2_8.onnx",
        output_labels=_HSEMOTION_LABELS,
        to_tensor=lambda image: imagenet_tensor(image, 260),
    ),
    "ferplus": ModelSpec(
        name="FER+ (original)",
        filename="emotion-ferplus-8.onnx",
        url="https://github.com/onnx/models/raw/main/validated/vision/body_analysis/emotion_ferplus/model/emotion-ferplus-8.onnx",
        output_labels=("neutral", "happiness", "surprise", "sadness", "anger", "disgust", "fear", "contempt"),
        to_tensor=ferplus_tensor,
    ),
}
DEFAULT_MODEL_ID = "hsemotion-b0"


def softmax(scores: np.ndarray) -> np.ndarray:
    """Raw scores -> probabilities that add up to 1."""
    shifted = np.exp(scores - np.max(scores))  # subtract the max so exp() can't overflow
    return shifted / shifted.sum()


class EmotionModel:
    """One loaded model. Load once (it takes a moment), then call `predict` as often as you like."""

    def __init__(self, spec: ModelSpec, path: Path):
        self.spec = spec
        self._session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        self._input_name = self._session.get_inputs()[0].name

    def predict(self, image_bgr: np.ndarray) -> dict[str, float]:
        """Colour face picture (from `preprocess.decode_image`) -> {emotion: probability} in LABELS order."""
        scores = self._session.run(None, {self._input_name: self.spec.to_tensor(image_bgr)})[0][0]
        by_label = dict(zip(self.spec.output_labels, softmax(scores)))
        return {label: float(by_label[label]) for label in LABELS}


def load_model(model_id: str, models_dir: Path = MODELS_DIR) -> EmotionModel:
    spec = MODEL_SPECS[model_id]
    path = Path(models_dir) / spec.filename
    if not path.exists():
        raise FileNotFoundError(
            f"Emotion model not found at {path}. Download it with:\n  curl -L -o \"{path}\" {spec.url}"
        )
    return EmotionModel(spec, path)


def load_available_models() -> dict[str, EmotionModel]:
    """Loads every model whose file is present. The default model is required."""
    models = {DEFAULT_MODEL_ID: load_model(DEFAULT_MODEL_ID)}
    for model_id, spec in MODEL_SPECS.items():
        if model_id not in models and spec.path.exists():
            models[model_id] = load_model(model_id)
    return models
