@echo off
chcp 65001 >nul
setlocal EnableExtensions
pushd "%~dp0.."

if not exist logs\server.pid (
  echo not running
  popd
  exit /b 0
)

set /p PID=<logs\server.pid
taskkill /PID %PID% /T /F >nul 2>&1
if not errorlevel 1 (
  echo stopped pid=%PID%
) else (
  echo pid %PID% not alive, cleaning pid file
)
del logs\server.pid
popd
