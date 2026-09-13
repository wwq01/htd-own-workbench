@echo off
chcp 65001 >nul
setlocal EnableExtensions
pushd "%~dp0.."

REM 载入 deploy\server.env：端口可能与默认 17388 不同（配置指定或端口顺延）
if exist deploy\server.env (
  for /F "usebackq tokens=1,* delims==" %%A in ("deploy\server.env") do (
    if not "%%~A"=="" set "%%~A=%%~B"
  )
)

set PID=
if exist logs\server.pid set /p PID=<logs\server.pid
if defined PID (
  tasklist /FI "PID eq %PID%" /NH 2>nul | findstr /I "%PID%" >nul
  if not errorlevel 1 (
    echo running pid=%PID%
  ) else (
    echo stopped (stale pid file: %PID%)
  )
) else (
  echo stopped
)

if not defined HTD_PORT set HTD_PORT=17388
echo --- health http://127.0.0.1:%HTD_PORT%/api/v1/system/health ---
curl -s --max-time 5 http://127.0.0.1:%HTD_PORT%/api/v1/system/health
echo.
popd
