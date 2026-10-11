import numpy as np
import pytest

from app.emotion_model import (
    DEFAULT_MODEL_ID,
    LABELS,
    MODEL_SPECS,
    load_available_models,
    load_model,
    onnx_threads,
    parse_model_ids,
    softmax,
)


def test_labels_are_the_8_emotions_in_the_order_the_frontend_uses():
    assert LABELS == ("neutral", "happiness", "surprise", "sadness", "anger", "disgust", "fear", "contempt")


def test_default_model_is_hsemotion_b0():
    assert DEFAULT_MODEL_ID == "hsemotion-b0"
    assert DEFAULT_MODEL_ID in MODEL_SPECS


def test_every_model_reports_all_8_labels():
    for spec in MODEL_SPECS.values():
        assert sorted(spec.output_labels) == sorted(LABELS)


def test_softmax_turns_scores_into_percentages():
    assert softmax(np.array([0.0, 0.0])) == pytest.approx([0.5, 0.5])
    probs = softmax(np.array([1.0, 2.0, 3.0]))
    assert probs.sum() == pytest.approx(1.0)
    assert np.argmax(probs) == 2


def test_softmax_handles_huge_scores_without_overflow():
    assert softmax(np.array([1000.0, 1000.0, -1000.0])) == pytest.approx([0.5, 0.5, 0.0])


def test_missing_model_file_gives_a_helpful_error(tmp_path):
    with pytest.raises(FileNotFoundError, match="enet_b0_8_best_vgaf.onnx"):
        load_model("hsemotion-b0", models_dir=tmp_path)


def test_unknown_model_id_is_rejected():
    with pytest.raises(KeyError):
        load_model("nope")


@pytest.fixture(scope="module", params=sorted(MODEL_SPECS))
def model(request):
    spec = MODEL_SPECS[request.param]
    if not spec.path.exists():
        pytest.skip(f"{spec.path.name} not downloaded")
    return load_model(request.param)


def test_predict_returns_all_8_emotions_as_probabilities(model):
    image = np.random.default_rng(1).integers(0, 256, (128, 128, 3), dtype=np.uint8)
    emotions = model.predict(image)
    assert tuple(emotions) == LABELS
    assert all(0.0 <= p <= 1.0 for p in emotions.values())
    assert sum(emotions.values()) == pytest.approx(1.0, abs=1e-5)
    assert all(type(p) is float for p in emotions.values())


# --- choosing which models to load (EMOTION_MODELS setting) ---


def test_parse_model_ids_reads_a_comma_list():
    assert parse_model_ids("hsemotion-b0, ferplus") == ["hsemotion-b0", "ferplus"]


def test_parse_model_ids_empty_means_all_available():
    assert parse_model_ids("") is None
    assert parse_model_ids(None) is None


def test_parse_model_ids_rejects_unknown_names():
    with pytest.raises(ValueError, match="nope"):
        parse_model_ids("hsemotion-b0,nope")


def test_load_only_the_listed_models_first_is_default():
    if not MODEL_SPECS["ferplus"].path.exists():
        pytest.skip("ferplus not downloaded")
    models = load_available_models(["ferplus"])
    assert list(models) == ["ferplus"]


# --- running well on small (fractional-CPU) servers ---


def test_onnx_threads_setting():
    assert onnx_threads(None) == 1  # default: one thread, so threads don't fight over a tiny CPU share
    assert onnx_threads("4") == 4
    with pytest.raises(ValueError):
        onnx_threads("0")


def test_model_uses_the_configured_thread_count():
    if not MODEL_SPECS[DEFAULT_MODEL_ID].path.exists():
        pytest.skip("default model not downloaded")
    options = load_model(DEFAULT_MODEL_ID, threads=1).session_options
    assert options.intra_op_num_threads == 1
    assert options.inter_op_num_threads == 1


def test_model_is_warmed_up_when_loaded():
    if not MODEL_SPECS[DEFAULT_MODEL_ID].path.exists():
        pytest.skip("default model not downloaded")
    assert load_model(DEFAULT_MODEL_ID).warmed_up
