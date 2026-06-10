$ErrorActionPreference = "Stop"

Write-Host "=== Building Llama Remote ==="

Write-Host "[1/2] Building frontend..."
Push-Location web
npm ci
npm run build
Pop-Location

Write-Host "[2/2] Building Go backend..."
go build -o llama-remote.exe ./cmd/server

Write-Host ""
Write-Host "=== Build complete ==="
Write-Host "Output: llama-remote.exe"
