#!/usr/bin/env bash
# 荒天帝工作台 · 服务端停止
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f logs/server.pid ]; then
  echo "not running (no logs/server.pid)"
  exit 0
fi

PID=$(cat logs/server.pid)
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "stopped pid=$PID"
  # Windows 下 POSIX 信号对控制台进程通常等同强制终止，收不到优雅退出钩子
  echo "提示：启用数据库加密时，进程被强杀（taskkill /F、断电）会留下运行期明文库；"
  echo "      下次启动会以它为准并告警，正常退出后自动重新加密。"
else
  echo "stale pid file (pid=$PID not alive), cleaning up"
fi
rm -f logs/server.pid
