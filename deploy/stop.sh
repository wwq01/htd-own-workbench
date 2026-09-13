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
else
  echo "stale pid file (pid=$PID not alive), cleaning up"
fi
rm -f logs/server.pid
