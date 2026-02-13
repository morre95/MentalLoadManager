@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"

if not exist "%BACKEND_DIR%\main.py" (
  echo Backend entrypoint not found: %BACKEND_DIR%\main.py
  exit /b 1
)

if not exist "%BACKEND_DIR%\venv\Scripts\activate.bat" (
  echo Backend venv activation script not found: %BACKEND_DIR%\venv\Scripts\activate.bat
  exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
  echo Frontend package.json not found: %FRONTEND_DIR%\package.json
  exit /b 1
)

echo Starting backend...
start "Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && call ""venv\Scripts\activate.bat"" && fastapi dev main.py"

echo Starting frontend...
start "Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev"

echo Both services launched in separate windows.
endlocal
