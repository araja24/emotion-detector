#!/usr/bin/env bash
# Render build: Python deps + built React site + emotion model, all in one web service.
# Runs from the repo root. Safe to run locally on Linux/macOS too.
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-22.12.0}"   # Vite needs Node ^20.19 or >= 22.12

echo "==> Python packages"
pip install --upgrade pip
pip install -r backend/requirements.txt

echo "==> Node.js"
node_major() { node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/'; }
if ! command -v node >/dev/null 2>&1 || [ "$(node_major)" -lt 22 ]; then
  # Render's Python image may not ship a new-enough Node, so fetch a private copy.
  NODE_DIR="$PWD/.node"
  if [ ! -x "$NODE_DIR/bin/node" ]; then
    echo "    downloading Node $NODE_VERSION"
    mkdir -p "$NODE_DIR"
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
      | tar -xJ -C "$NODE_DIR" --strip-components=1
  fi
  export PATH="$NODE_DIR/bin:$PATH"
fi
echo "    using node $(node -v), npm $(npm -v)"

echo "==> Frontend build"
cd frontend
npm ci
npm run build   # prebuild also copies MediaPipe's wasm and downloads the face landmark model
cd ..

echo "==> Emotion model(s): ${EMOTION_MODELS:-hsemotion-b0}"
cd backend
python -m app.download_models
cd ..

echo "==> Build finished"
