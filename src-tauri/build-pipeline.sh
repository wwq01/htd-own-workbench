#!/usr/bin/env bash
# S3-1 真机编译串联脚本：等待 winlibs 7z 下载完成 → 解压 MinGW → cargo build
# 用法：bash src-tauri/build-pipeline.sh   （后台运行，日志见 $LOG）
set -uo pipefail

MINGW7Z="/c/Users/weiwq/.workbuddy/mingw64.7z"
MINGWROOT="/c/Users/weiwq/.workbuddy/mingw64"
LOG="/c/Users/weiwq/.workbuddy/tauri-build.log"
PY="/c/Users/weiwq/.workbuddy/binaries/python/envs/default/Scripts/python.exe"

ts() { date +%H:%M:%S; }
log() { echo "[$(ts)] $*" | tee -a "$LOG"; }

log "=== S3-1 build pipeline start ==="

# 1) 等待下载真正完成：文件 >= 100MB 且连续 2 次(30s)体积不变 才认为下载结束
EXPECTED=100000000
prev=0
stable=0
done=0
for i in $(seq 1 360); do
  sz=0
  if [ -f "$MINGW7Z" ]; then sz=$(stat -c%s "$MINGW7Z" 2>/dev/null || echo 0); fi
  if [ "$sz" -ge "$EXPECTED" ]; then
    if [ "$sz" -eq "$prev" ]; then
      stable=$((stable+1))
      if [ "$stable" -ge 2 ]; then
        log "mingw64.7z download complete: $sz bytes (stable after iter $i)"
        done=1
        break
      fi
    else
      stable=0
    fi
  fi
  prev=$sz
  sleep 15
done

if [ "$done" -ne 1 ]; then
  log "ERROR: timeout/partial waiting for mingw64.7z (last size=$prev)"
  exit 1
fi

# 2) 用 py7zr 解压 MinGW（Windows 原生 Python 需 Windows 风格路径）
log "extracting MinGW via py7zr ..."
"$PY" -c "import py7zr; py7zr.SevenZipFile(r'C:/Users/weiwq/.workbuddy/mingw64.7z').extractall(r'C:/Users/weiwq/.workbuddy')"
if [ ! -f "$MINGWROOT/bin/windres.exe" ]; then
  log "ERROR: windres.exe missing after extract (check 7z integrity)"
  exit 1
fi
log "windres: $("$MINGWROOT/bin/windres.exe" --version 2>&1 | head -1)"

# 3) 真机编译 S3-1 骨架（cargo build 不触发 beforeBuildCommand，直接编译 Rust + 嵌入占位 sidecar/icons）
export PATH="$MINGWROOT/bin:$PATH"
export PATH="/c/Users/weiwq/.cargo/bin:$PATH"
cd /d/WorkSpace/htd-own-workbench/src-tauri
log "cargo build starting ..."
cargo build 2>&1 | tee -a "$LOG"
rc=${PIPESTATUS[0]}
log "cargo build exit=$rc"
exit $rc
