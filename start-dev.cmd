@echo off
setlocal
cd /d "%~dp0"
echo.
echo EMPATHY Pro 2.0 — avvio dev (porta default 3020, vedi console se cambia^)
echo Root monorepo: %CD%
echo.
npm run dev
