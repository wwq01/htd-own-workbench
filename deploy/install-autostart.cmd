@echo off
chcp 65001 >nul
REM 登录即自启（普通用户权限即可，无需管理员）
schtasks /Create /TN "HTDWorkbench" /TR "\"%~dp0start.cmd\"" /SC ONLOGON /F
if not errorlevel 1 (
  echo installed. remove: deploy\uninstall-autostart.cmd
) else (
  echo install failed
)
