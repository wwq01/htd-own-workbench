#!/usr/bin/env bash
# 荒天帝工作台 · 服务状态与探活
set -euo pipefail

cd "$(dirname "$0")/.."

# 载入配置：端口可能与默认 17388 不同（server.env 指定或端口顺延）
if [ -f deploy/server.env ]; then
  set -a
  # shellcheck disable=SC1091
  . deploy/server.env
  set +a
fi

if [ -f logs/server.pid ] && kill -0 "$(cat logs/server.pid)" 2>/dev/null; then
  echo "running  pid=$(cat logs/server.pid)"
else
  echo "stopped"
fi

PORT=${HTD_PORT:-17388}
echo "--- health: http://127.0.0.1:${PORT}/api/v1/system/health ---"
curl -s --max-time 5 "http://127.0.0.1:${PORT}/api/v1/system/health" || echo "(no response)"
echo
