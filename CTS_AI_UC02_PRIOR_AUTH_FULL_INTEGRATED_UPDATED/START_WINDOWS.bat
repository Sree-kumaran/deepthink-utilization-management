@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo UC02 PRIOR AUTHORIZATION - START
echo ========================================
if not exist "backend\.env" (
  echo backend\.env is missing. Run SETUP_WINDOWS.ps1 first.
  pause
  exit /b 1
)
if not exist "frontend\node_modules" (
  echo Frontend dependencies are missing. Run SETUP_WINDOWS.ps1 first.
  pause
  exit /b 1
)
start "Inference Pipeline Docker" cmd /k "cd /d "%~dp0..\inference-pipeline" && docker compose up --build"
timeout /t 5 /nobreak >nul
start "UC02 Backend - Docker" cmd /k "cd /d "%~dp0backend" && docker compose up --build"
timeout /t 8 /nobreak >nul
start "UC02 Frontend - Vite" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --host 0.0.0.0"
echo.
echo Backend:            http://localhost:8000/docs
echo Frontend:           http://localhost:5173
echo Inference Pipeline: http://localhost:8001/health
echo.
pause
