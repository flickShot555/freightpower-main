param(
    [switch]$SkipChecks
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Test-Cmd($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

if (-not $SkipChecks) {
    if (-not (Test-Cmd "node")) {
        throw "Node.js is not installed or not on PATH."
    }
    if (-not (Test-Cmd "npm")) {
        throw "npm is not installed or not on PATH."
    }
    if (-not (Test-Cmd "python")) {
        throw "Python is not installed or not on PATH."
    }

    if (-not (Test-Path ".\node_modules")) {
        throw "Missing node_modules. Run 'npm ci' first."
    }
    if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
        throw "Missing virtualenv at .venv. Create it and install backend deps first."
    }
    if (-not (Test-Path ".\apps\serviceAccountKey.json")) {
        throw "Missing apps\serviceAccountKey.json (Firebase Admin credential)."
    }
}

$frontendCmd = @"
Set-Location '$root'
npm run dev
"@

$backendCmd = @"
Set-Location '$root'
& '.\.venv\Scripts\python.exe' -m uvicorn apps.api.main:app --reload --port 8000
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd | Out-Null
Start-Sleep -Milliseconds 600
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd | Out-Null

Write-Host "Started services in separate windows:"
Write-Host "  Backend (FastAPI): http://localhost:8000/docs"
Write-Host "  Frontend (Vite):   http://localhost:5173"
