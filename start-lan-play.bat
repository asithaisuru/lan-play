@echo off
setlocal

set "ROOT=%~dp0"

echo Starting LAN Play backend and frontend...
echo.

if not exist "%ROOT%backend\node_modules" (
  echo Backend dependencies are missing. Run npm install inside backend first.
  pause
  exit /b 1
)

if not exist "%ROOT%frontend\node_modules" (
  echo Frontend dependencies are missing. Run npm install inside frontend first.
  pause
  exit /b 1
)

start "LAN Play Backend" cmd /k "cd /d ""%ROOT%backend"" && npm start"
start "LAN Play Frontend" cmd /k "cd /d ""%ROOT%frontend"" && npm run dev"

echo Backend and frontend windows are starting.
echo Backend:  http://localhost:5000
echo Frontend: check the LAN Play Frontend window for the Vite URL.
echo.
pause
