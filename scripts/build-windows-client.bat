@echo off
setlocal

cd /d "%~dp0\.."

echo.
echo ============================================================
echo  W-Light Windows client one-click builder
echo ============================================================
echo.
echo This script will build the Windows installer and publish it to:
echo   deploy\downloads\W-Light-Setup-latest.exe
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not in PATH.
  echo Please install Node.js 20 LTS, then run this script again.
  echo Download: https://nodejs.org/
  pause
  exit /b 1
)

echo Checking Node.js...
node -v

echo.
echo Enabling Corepack...
corepack enable
if errorlevel 1 (
  echo ERROR: corepack enable failed.
  pause
  exit /b 1
)

echo.
echo Installing dependencies...
corepack pnpm install --frozen-lockfile
if errorlevel 1 (
  echo ERROR: dependency installation failed.
  pause
  exit /b 1
)

echo.
echo Building Windows installer...
powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\desktop-release.ps1" -Target win -PublishWeb
if errorlevel 1 (
  echo ERROR: Windows installer build failed.
  echo If the error mentions a long path, move this repository to a short path such as C:\WL and try again.
  pause
  exit /b 1
)

echo.
echo Verifying download artifacts...
corepack pnpm downloads:verify -- --strict
if errorlevel 1 (
  echo ERROR: download artifact verification failed.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  Build completed
echo ============================================================
echo Installer:
echo   %CD%\deploy\downloads\W-Light-Setup-latest.exe
echo.
echo Upload these files to the server if you built locally:
echo   deploy\downloads\W-Light-Setup-latest.exe
echo   deploy\downloads\W-Light-Setup-latest.exe.sha256
echo   deploy\downloads\w-light-desktop.json
echo.
pause
