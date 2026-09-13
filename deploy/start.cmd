@echo off
chcp 65001 >nul
setlocal EnableExtensions
pushd "%~dp0.."

if not exist logs mkdir logs

REM 载入 deploy\server.env（含访问令牌，该文件已在 .gitignore 中）
if exist deploy\server.env (
  for /F "usebackq tokens=1,* delims==" %%A in ("deploy\server.env") do (
    if not "%%~A"=="" set "%%~A=%%~B"
  )
)

REM 服务端常驻模式：不开浏览器、不做端口占用复用退出
set HTD_SERVER=1

REM 前端构建产物缺失则就地构建（frontend/dist 不入版本库，克隆后必须构建一次）
if not exist frontend\dist\index.html (
  echo frontend\dist not found, building...
  pushd frontend
  call npm run build
  popd
  if not exist frontend\dist\index.html (
    echo frontend build failed
    popd
    exit /b 1
  )
)

set OLDPID=
if exist logs\server.pid set /p OLDPID=<logs\server.pid
if defined OLDPID (
  tasklist /FI "PID eq %OLDPID%" /NH 2>nul | findstr /I "%OLDPID%" >nul
  if not errorlevel 1 (
    echo already running pid=%OLDPID%
    popd
    exit /b 0
  )
  del logs\server.pid
)

powershell -NoProfile -Command "$p = Start-Process -FilePath 'node' -ArgumentList 'backend\src\server.js' -WorkingDirectory '%CD%' -WindowStyle Hidden -PassThru -RedirectStandardOutput 'logs\server.out.log' -RedirectStandardError 'logs\server.err.log'; if ($p) { Set-Content -Path 'logs\server.pid' -Value $p.Id -Encoding ascii; Write-Host ('started pid=' + $p.Id) } else { Write-Host 'start failed' }"

echo log  %CD%\logs\server.out.log
echo stop deploy\stop.cmd
popd
