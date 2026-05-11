@echo off
cd /d "C:\Users\lili\Desktop\styleshoot"

if not exist "node_modules" (
  echo Instalando dependencias por primera vez, esperá un momento...
  call npm install
  echo.
)

start "" "http://localhost:3001"
timeout /t 2 /nobreak >nul
npm run dev
