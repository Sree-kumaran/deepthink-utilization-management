@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo UC02 PRIOR AUTHORIZATION - SETUP
echo ========================================
where node >nul 2>nul || (echo Node.js is required. Install Node.js 20+ and try again.& pause& exit /b 1)
where docker >nul 2>nul || (echo Docker Desktop is required. Install/start Docker Desktop and try again.& pause& exit /b 1)
if not exist "backend\.env" copy /Y "backend\.env.example" "backend\.env" >nul
if not exist "frontend\.env" copy /Y "frontend\.env.example" "frontend\.env" >nul
cd frontend
if not exist node_modules (echo Installing frontend dependencies...& npm ci)
if errorlevel 1 (echo npm install failed.& pause& exit /b 1)
npm run lint
cd ..
echo.
echo Setup complete.
echo IMPORTANT: edit backend\.env and set your real GEMINI_API_KEY.
echo Then run START_WINDOWS.bat
pause
