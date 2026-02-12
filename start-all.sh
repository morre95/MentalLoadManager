#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

if [[ ! -f "$BACKEND_DIR/main.py" ]]; then
  echo "Backend entrypoint not found: $BACKEND_DIR/main.py"
  exit 1
fi

if [[ ! -f "$FRONTEND_DIR/package.json" ]]; then
  echo "Frontend package.json not found: $FRONTEND_DIR/package.json"
  exit 1
fi

cleanup() {
  echo "Stopping services..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

echo "Starting backend..."
(
  cd "$BACKEND_DIR"
  if [[ ! -f "$BACKEND_DIR/venv/bin/activate" ]]; then
    echo "Backend venv activation script not found: $BACKEND_DIR/venv/bin/activate"
    exit 1
  fi
  # shellcheck disable=SC1091
  source "$BACKEND_DIR/venv/bin/activate"
  fastapi dev main.py
) &
BACKEND_PID=$!

echo "Starting frontend..."
(
  cd "$FRONTEND_DIR"
  npm run dev
) &
FRONTEND_PID=$!

echo "Both services started. Press Ctrl+C to stop."
wait -n "$BACKEND_PID" "$FRONTEND_PID"
