@echo off
setlocal

set "ROOT_DIR=%~dp0"

if not exist "%ROOT_DIR%backend\main.py" (
  echo Backend entrypoint not found: %ROOT_DIR%backend\main.py
  exit /b 1
)

if not exist "%ROOT_DIR%backend\venv\Scripts\activate.bat" (
  echo Backend venv activation script not found: %ROOT_DIR%backend\venv\Scripts\activate.bat
  exit /b 1
)

if not exist "%ROOT_DIR%frontend\package.json" (
  echo Frontend package.json not found: %ROOT_DIR%frontend\package.json
  exit /b 1
)

echo Starting backend...
start "Backend" cmd /k "cd /d \"%ROOT_DIR%backend\" && call venv\Scripts\activate.bat && fastapi dev main.py"

echo Starting frontend...
start "Frontend" cmd /k "cd /d \"%ROOT_DIR%frontend\" && npm run dev"

echo Both services launched in separate windows.
endlocal
