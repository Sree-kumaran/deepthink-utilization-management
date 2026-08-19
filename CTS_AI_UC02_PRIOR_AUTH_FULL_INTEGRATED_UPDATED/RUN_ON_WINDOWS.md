# UC02 Prior Authorization - Windows Run Guide

## Important

This package does **not** include `node_modules` or a Python virtual environment. That is intentional: those directories are generated dependencies, are very large, and can contain OS/CPU-specific native binaries. The package includes `package-lock.json`, so `npm ci` recreates the exact frontend dependency tree.

The package includes safe `.env` templates. A real Gemini API key is **not** bundled because API keys are secrets. You must put your own key in `backend\.env`.

## First-time setup

1. Install Docker Desktop and Node.js 20+ on Windows.
2. Start Docker Desktop.
3. Run `SETUP_WINDOWS.ps1` from PowerShell. If PowerShell blocks scripts, run:

   `powershell -ExecutionPolicy Bypass -File .\SETUP_WINDOWS.ps1`

4. Open `backend\.env`. Replace:

   `GEMINI_API_KEY=PASTE_YOUR_GEMINI_API_KEY_HERE`

   with your actual Gemini API key.

5. Run `START_WINDOWS.bat`.

## URLs

- Frontend: http://localhost:5173
- Backend Swagger: http://localhost:8000/docs
- Backend health: http://localhost:8000/api/v1/health/live
- Qdrant: http://localhost:6333/dashboard

## What START_WINDOWS does

- Starts PostgreSQL in Docker
- Starts Qdrant in Docker
- Builds/starts the FastAPI backend
- Runs database migrations
- Seeds the permanent 10 payer policies
- Indexes policy evidence into Qdrant
- Starts the React/Vite frontend

## Existing data

Docker volumes persist PostgreSQL and Qdrant data across restarts. Do not run `docker compose down -v` unless you intentionally want to delete those volumes.

## Frontend dependencies

If `node_modules` is missing, run:

`cd frontend`
`npm ci`

Then:

`npm run dev`

Do not copy `node_modules` from another Windows/Linux machine. `npm ci` is the correct way to recreate it.

## Gemini key

The backend uses Gemini for RAG embeddings/generation. Without a valid Gemini key, the API container cannot initialize its Gemini service, so RAG/policy indexing will not work. The key must remain local in `backend\.env` and must never be committed to Git.
