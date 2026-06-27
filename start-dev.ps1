#!/usr/bin/env pwsh

# MAD Club Management Portal - Startup Script (PowerShell)

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "MAD Club Management Portal - Startup" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking if Node.js is installed..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
Write-Host ""

# Check if package.json exists
Write-Host "Checking project directory..." -ForegroundColor Yellow
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: package.json not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✓ Project directory verified" -ForegroundColor Green
Write-Host ""

# Check if dependencies are installed
Write-Host "Checking dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "✓ Dependencies already installed" -ForegroundColor Green
} else {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Starting Development Server..." -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "🌐 Server will start on: http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Access points:" -ForegroundColor Cyan
Write-Host "  • Member Login: http://localhost:3000/login/member" -ForegroundColor White
Write-Host "  • Admin Login:  http://localhost:3000/login/admin" -ForegroundColor White
Write-Host "  • Register:     http://localhost:3000/register" -ForegroundColor White
Write-Host "  • Home:         http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "⌨️  Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start development server
npm run dev

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Failed to start development server" -ForegroundColor Red
    Write-Host "Please check if port 3000 is already in use:" -ForegroundColor Red
    Write-Host "  Get-NetTCPConnection -LocalPort 3000" -ForegroundColor Gray
    Read-Host "Press Enter to exit"
    exit 1
}
