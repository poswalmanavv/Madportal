@echo off
REM MAD Club Management Portal - Startup Script (Windows)
echo ===============================================
echo MAD Club Management Portal - Startup
echo ===============================================
echo.

echo Checking if Node.js is installed...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

echo Checking project directory...
if not exist "package.json" (
    echo ERROR: package.json not found!
    echo Please run this script from the project root directory.
    pause
    exit /b 1
)

echo.
echo ===============================================
echo Starting Development Server...
echo ===============================================
echo.

if exist "node_modules" (
    echo ✓ Dependencies already installed
) else (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

echo.
echo The server will start on: http://localhost:3000
echo.
echo To access the portal:
echo - Member Login: http://localhost:3000/login/member
echo - Admin Login:  http://localhost:3000/login/admin
echo - Register:     http://localhost:3000/register
echo.
echo Press Ctrl+C to stop the server.
echo.

REM Start development server
call npm run dev

if errorlevel 1 (
    echo.
    echo ERROR: Failed to start development server
    echo Please check if port 3000 is already in use
    pause
    exit /b 1
)
