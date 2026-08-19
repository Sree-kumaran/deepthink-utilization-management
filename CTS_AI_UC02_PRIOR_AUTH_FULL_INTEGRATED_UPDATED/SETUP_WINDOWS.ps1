$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

Write-Host "=== UC02 Prior Authorization Setup ===" -ForegroundColor Cyan

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker is not installed or not on PATH." }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is not installed or not on PATH." }

if (-not (Test-Path (Join-Path $Backend ".env"))) { Copy-Item (Join-Path $Backend ".env.example") (Join-Path $Backend ".env") }
if (-not (Test-Path (Join-Path $Frontend ".env"))) { Copy-Item (Join-Path $Frontend ".env.example") (Join-Path $Frontend ".env") }

$envFile = Get-Content (Join-Path $Backend ".env") -Raw
if ($envFile -match "PASTE_YOUR_GEMINI_API_KEY_HERE") {
  Write-Host "ACTION REQUIRED: Open backend\.env and replace GEMINI_API_KEY=PASTE_YOUR_GEMINI_API_KEY_HERE with your real Gemini API key." -ForegroundColor Yellow
}

Push-Location $Frontend
if (-not (Test-Path "node_modules")) {
  Write-Host "Installing frontend dependencies with npm ci..." -ForegroundColor Cyan
  npm ci
} else {
  Write-Host "Frontend node_modules already exists; skipping npm ci." -ForegroundColor Green
}
npm run lint
Pop-Location

Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Next: edit backend\.env with your Gemini key, then run START_WINDOWS.bat" -ForegroundColor Yellow
