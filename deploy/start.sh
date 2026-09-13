#!/usr/bin/env bash
# 荒天帝工作台 · 服务端启动（Git Bash / Linux / macOS）
# 用法：bash deploy/start.sh
set -euo pipefail

cd "$(dirname "$0")/.."

# 载入配置（server.env 含令牌，已在 .gitignore 中）
if [ -f deploy/server.env ]; then
  set -a
  # shellcheck disable=SC1091
  . deploy/server.env
  set +a
fi

# 常驻模式：不开浏览器、不做端口占用复用退出
export HTD_SERVER=1

mkdir -p logs

# 前端构建产物缺失则就地构建（frontend/dist 不入版本库，克隆后必须构建一次，
# 否则访问会 404——app.js 在 dist 缺失时回退到源码目录，行为不稳定）
if [ ! -f frontend/dist/index.html ]; then
  echo "frontend/dist not found, building..."
  (cd frontend && npm run build) || { echo "frontend build failed"; exit 1; }
fi

# 已在运行则直接退出，避免多进程争抢 SQLite 写锁
if [ -f logs/server.pid ]; then
  OLD=$(cat logs/server.pid)
  if kill -0 "$OLD" 2>/dev/null; then
    echo "already running (pid=$OLD). Use deploy/stop.sh first."
    exit 0
  fi
  rm -f logs/server.pid
fi

nohup node backend/src/server.js >> logs/server.log 2>&1 &
echo $! > logs/server.pid

echo "started  pid=$(cat logs/server.pid)"
echo "log      $(pwd)/logs/server.log"
echo "stop     bash deploy/stop.sh"
