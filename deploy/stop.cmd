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
REM 先尝试优雅结束，给服务端回收的机会（启用加密时要把运行期明文库重新加密落盘）。
REM 控制台程序通常不响应，失败后再强制结束。
taskkill /PID %PID% /T >nul 2>&1
if not errorlevel 1 (
  echo stopped pid=%PID%
) else (
  taskkill /PID %PID% /T /F >nul 2>&1
  if not errorlevel 1 (
    echo force stopped pid=%PID%
    echo note: forced kill skips graceful exit. if encryption is on, the runtime plaintext db
    echo       remains and will be reused with a warning on next start, then re-encrypted.
  ) else (
    echo pid %PID% not alive, cleaning pid file
  )
)
del logs\server.pid
popd
