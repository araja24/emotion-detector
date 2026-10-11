import cv2
import numpy as np
import pytest

from app.preprocess import InvalidImageError, decode_image, ferplus_tensor, imagenet_tensor


def encode_jpeg(image: np.ndarray) -> bytes:
    ok, buffer = cv2.imencode(".jpg", image)
    assert ok
    return buffer.tobytes()


def test_decode_gives_a_color_picture():
    image = np.random.default_rng(0).integers(0, 256, (200, 150, 3), dtype=np.uint8)
    decoded = decode_image(encode_jpeg(image))
    assert decoded.shape == (200, 150, 3)
    assert decoded.dtype == np.uint8


def test_png_works_too():
    ok, png = cv2.imencode(".png", np.zeros((80, 80, 3), dtype=np.uint8))
    assert ok
    assert decode_image(png.tobytes()).shape == (80, 80, 3)


@pytest.mark.parametrize("data", [b"", b"definitely not a picture", b"\xff\xd8\xff\x00broken"])
def test_bad_bytes_raise_invalid_image_error(data):
    with pytest.raises(InvalidImageError):
        decode_image(data)


# --- FER+: gray, 64x64, raw 0-255 ---


def test_ferplus_tensor_is_one_gray_64x64_picture():
    image = np.random.default_rng(1).integers(0, 256, (200, 150, 3), dtype=np.uint8)
    tensor = ferplus_tensor(image)
    assert tensor.shape == (1, 1, 64, 64)
    assert tensor.dtype == np.float32


def test_ferplus_keeps_pixels_in_0_to_255():
    # FER+ was trained on raw 0-255 gray values, not 0-1.
    tensor = ferplus_tensor(np.full((128, 128, 3), 255, dtype=np.uint8))
    assert tensor.min() == pytest.approx(255)


# --- HSEmotion: RGB, square, ImageNet-normalised ---


@pytest.mark.parametrize("size", [224, 260])
def test_imagenet_tensor_shape(size):
    tensor = imagenet_tensor(np.zeros((128, 128, 3), dtype=np.uint8), size)
    assert tensor.shape == (1, 3, size, size)
    assert tensor.dtype == np.float32


def test_imagenet_tensor_is_rgb_and_normalised():
    # A pure-blue OpenCV (BGR) picture must land in the *third* (blue) channel of RGB.
    blue_bgr = np.zeros((32, 32, 3), dtype=np.uint8)
    blue_bgr[..., 0] = 255
    tensor = imagenet_tensor(blue_bgr, 224)
    red, green, blue = (tensor[0, c].mean() for c in range(3))
    assert red == pytest.approx((0 - 0.485) / 0.229, abs=1e-3)
    assert green == pytest.approx((0 - 0.456) / 0.224, abs=1e-3)
    assert blue == pytest.approx((1 - 0.406) / 0.225, abs=1e-3)
