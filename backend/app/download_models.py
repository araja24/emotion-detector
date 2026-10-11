"""Download emotion model files into backend/models/.

    python -m app.download_models                     # models in $EMOTION_MODELS, else the default
    python -m app.download_models hsemotion-b2 ferplus
    python -m app.download_models all
"""

import os
import sys
import urllib.request

from app.emotion_model import DEFAULT_MODEL_ID, MODEL_SPECS, MODELS_DIR, parse_model_ids


def download(model_id: str) -> None:
    spec = MODEL_SPECS[model_id]
    if spec.path.exists() and spec.path.stat().st_size > 0:
        print(f"[models] {model_id}: already present")
        return
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[models] {model_id}: downloading {spec.url}")
    partial = spec.path.with_suffix(".part")
    urllib.request.urlretrieve(spec.url, partial)
    partial.replace(spec.path)  # only appears under its real name once complete
    print(f"[models] {model_id}: saved {spec.path.stat().st_size / 1e6:.1f} MB")


def main(args: list[str]) -> None:
    if args == ["all"]:
        ids = list(MODEL_SPECS)
    elif args:
        ids = parse_model_ids(",".join(args)) or []
    else:
        ids = parse_model_ids(os.environ.get("EMOTION_MODELS")) or [DEFAULT_MODEL_ID]
    for model_id in ids:
        download(model_id)


if __name__ == "__main__":
    main(sys.argv[1:])
