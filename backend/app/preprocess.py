"""Turns picture bytes into exactly what each emotion model wants."""

import cv2
import numpy as np

# ImageNet colour averages — HSEmotion was trained on pictures adjusted by these.
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


class InvalidImageError(ValueError):
    """The bytes we got are not a picture we can open."""


def decode_image(data: bytes) -> np.ndarray:
    """JPEG/PNG bytes -> colour picture (OpenCV's BGR order, uint8)."""
    if not data:
        raise InvalidImageError("empty image")
    try:
        image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    except cv2.error as err:
        raise InvalidImageError(str(err)) from err
    if image is None or image.size == 0:
        raise InvalidImageError("could not decode image")
    return image


def ferplus_tensor(image_bgr: np.ndarray) -> np.ndarray:
    """FER+: gray -> 64x64 -> float32 (1, 1, 64, 64), raw 0-255 values."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (64, 64), interpolation=cv2.INTER_AREA)
    return small.astype(np.float32)[np.newaxis, np.newaxis, :, :]


def imagenet_tensor(image_bgr: np.ndarray, size: int) -> np.ndarray:
    """HSEmotion: RGB -> size x size -> 0-1 -> ImageNet-normalised float32 (1, 3, size, size)."""
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, (size, size), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255
    normalised = (resized - IMAGENET_MEAN) / IMAGENET_STD
    return normalised.transpose(2, 0, 1)[np.newaxis].astype(np.float32)
