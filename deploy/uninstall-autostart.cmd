@echo off
chcp 65001 >nul
schtasks /Delete /TN "HTDWorkbench" /F
if not errorlevel 1 (
  echo autostart removed
) else (
  echo not installed or remove failed
)
