@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo STARTING FULL PRIOR AUTHORIZATION + INFERENCE PIPELINE STACK
echo ============================================================
echo.

echo [1/3] Starting Inference Pipeline (XGBoost + PriorAuthLM)...
start "Inference Pipeline Docker" cmd /k "cd /d "%~dp0inference-pipeline" && docker compose up --build"

echo Waiting 5 seconds for inference pipeline network initialization...
timeout /t 5 /nobreak >nul

echo [2/3] Starting Prior Authorization Backend (FastAPI, Postgres, Qdrant)...
start "Prior Auth Backend Docker" cmd /k "cd /d "%~dp0CTS_AI_UC02_PRIOR_AUTH_FULL_INTEGRATED_UPDATED\backend" && docker compose up --build"

echo Waiting 8 seconds for backend initialization...
timeout /t 8 /nobreak >nul

echo [3/3] Starting Frontend (Vite/React)...
start "Prior Auth Frontend" cmd /k "cd /d "%~dp0CTS_AI_UC02_PRIOR_AUTH_FULL_INTEGRATED_UPDATED\frontend" && npm run dev -- --host 0.0.0.0"

echo.
echo ============================================================
echo SERVICES RUNNING:
echo - Frontend:           http://localhost:5173
echo - Backend API Docs:   http://localhost:8000/docs
echo - Inference Pipeline: http://localhost:8001/health
echo ============================================================
echo.
pause
