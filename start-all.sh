#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
MOBILE_DIR="$ROOT_DIR/mobile"

if [[ ! -f "$BACKEND_DIR/main.py" ]]; then
  echo "Backend entrypoint not found: $BACKEND_DIR/main.py"
  exit 1
fi

if [[ ! -f "$BACKEND_DIR/venv/bin/activate" ]]; then
  echo "Backend venv activation script not found: $BACKEND_DIR/venv/bin/activate"
  exit 1
fi

if [[ ! -f "$FRONTEND_DIR/package.json" ]]; then
  echo "Frontend package.json not found: $FRONTEND_DIR/package.json"
  exit 1
fi

if [[ ! -f "$MOBILE_DIR/package.json" ]]; then
  echo "Mobile package.json not found: $MOBILE_DIR/package.json"
  exit 1
fi

launch_terminal() {
  local title="$1"
  local command="$2"

  if command -v gnome-terminal >/dev/null 2>&1; then
    gnome-terminal --title="$title" -- bash -lc "$command; exec bash"
    return 0
  fi

  if command -v x-terminal-emulator >/dev/null 2>&1; then
    x-terminal-emulator -T "$title" -e bash -lc "$command; exec bash"
    return 0
  fi

  if command -v konsole >/dev/null 2>&1; then
    konsole --new-tab -p tabtitle="$title" -e bash -lc "$command; exec bash" &
    return 0
  fi

  if command -v xfce4-terminal >/dev/null 2>&1; then
    xfce4-terminal --title="$title" --command="bash -lc '$command; exec bash'" &
    return 0
  fi

  if command -v xterm >/dev/null 2>&1; then
    xterm -T "$title" -e bash -lc "$command; exec bash" &
    return 0
  fi

  if [[ "$OSTYPE" == darwin* ]] && command -v osascript >/dev/null 2>&1; then
    osascript <<EOF >/dev/null
tell application "Terminal"
  do script "bash -lc $(printf '%q' "$command; exec bash")"
  set custom title of front window to "$title"
  activate
end tell
EOF
    return 0
  fi

  echo "No supported terminal emulator found for: $title"
  echo "Run manually:"
  echo "  $command"
  return 1
}

backend_command="cd $(printf '%q' "$BACKEND_DIR") && source $(printf '%q' "$BACKEND_DIR/venv/bin/activate") && fastapi dev main.py"
frontend_command="cd $(printf '%q' "$FRONTEND_DIR") && npm run dev"
mobile_command="cd $(printf '%q' "$MOBILE_DIR") && npm run start"

echo "Opening backend terminal..."
launch_terminal "Mental Load Manager Backend" "$backend_command"

echo "Opening frontend terminal..."
launch_terminal "Mental Load Manager Frontend" "$frontend_command"

read -r -p "Open a terminal window for the Expo app in mobile/? [y/N] " open_mobile
case "$open_mobile" in
  [yY]|[yY][eE][sS])
    echo "Opening mobile terminal..."
    launch_terminal "Mental Load Manager Mobile" "$mobile_command"
    ;;
esac

echo "Requested terminal windows have been opened."
