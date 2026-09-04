@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required.
  pause
  exit /b 1
)

echo Installing pinned dependencies...
call npm install
if errorlevel 1 exit /b 1

echo.
echo Generating the standalone bundle...
call npm run build
if errorlevel 1 exit /b 1

echo.
echo Starting Story Builder...
call npm start
pause
