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
  local command_escaped
  command_escaped="$(printf '%q' "$command")"
  local wrapped_command="trap '' INT; (trap - INT; eval $command_escaped); printf '\nServer stopped. You can restart it here or press Ctrl+D to close the shell.\n'; exec bash -i"
  local wrapped_command_escaped
  wrapped_command_escaped="$(printf '%q' "$wrapped_command")"

  if command -v alacritty >/dev/null 2>&1; then
    alacritty --title "$title" --working-directory "$ROOT_DIR" -e bash -ic "$wrapped_command" &
    return 0
  fi

  if command -v ghostty >/dev/null 2>&1; then
    ghostty --title="$title" -e bash -ic "$wrapped_command" &
    return 0
  fi

  if command -v gnome-terminal >/dev/null 2>&1; then
    gnome-terminal --title="$title" -- bash -ic "$wrapped_command" &
    return 0
  fi

  if command -v x-terminal-emulator >/dev/null 2>&1; then
    x-terminal-emulator -T "$title" -e bash -ic "$wrapped_command" &
    return 0
  fi

  if command -v konsole >/dev/null 2>&1; then
    konsole --new-tab -p tabtitle="$title" -e bash -ic "$wrapped_command" &
    return 0
  fi

  if command -v xfce4-terminal >/dev/null 2>&1; then
    xfce4-terminal --title="$title" --command="bash -ic $wrapped_command_escaped" &
    return 0
  fi

  if command -v xterm >/dev/null 2>&1; then
    xterm -T "$title" -e bash -ic "$wrapped_command" &
    return 0
  fi

  if [[ "$OSTYPE" == darwin* ]] && command -v osascript >/dev/null 2>&1; then
    osascript <<EOF >/dev/null
tell application "Terminal"
  do script "bash -ic $wrapped_command_escaped"
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

backend_command="cd $(printf '%q' "$BACKEND_DIR") && $(printf '%q' "$BACKEND_DIR/venv/bin/fastapi") dev main.py"
frontend_command="cd $(printf '%q' "$FRONTEND_DIR") && npm run dev"
mobile_command="cd $(printf '%q' "$MOBILE_DIR") && npm run start"
launch_failures=0

echo "Opening backend terminal..."
if ! launch_terminal "Mental Load Manager Backend" "$backend_command"; then
  launch_failures=$((launch_failures + 1))
fi

echo "Opening frontend terminal..."
if ! launch_terminal "Mental Load Manager Frontend" "$frontend_command"; then
  launch_failures=$((launch_failures + 1))
fi

read -r -p "Open a terminal window for the Expo app in mobile/? [y/N] " open_mobile
case "$open_mobile" in
  [yY]|[yY][eE][sS])
    echo "Opening mobile terminal..."
    if ! launch_terminal "Mental Load Manager Mobile" "$mobile_command"; then
      launch_failures=$((launch_failures + 1))
    fi
    ;;
esac

if ((launch_failures > 0)); then
  echo "Finished with $launch_failures launcher failure(s)."
  exit 1
fi

echo "Requested terminal windows have been opened."
