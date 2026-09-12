#!/usr/bin/env bash
# Resilient MinGW-w64 (winlibs, MSVCRT) downloader + extractor for S3-1 cargo build.
# Strategy: resume-loop (-C -) so a dropped connection re-accumulates instead of restarting.
set -u
URL="https://github.com/brechtsanders/winlibs_mingw/releases/download/16.2.0posix-14.0.0-msvcrt-r1/winlibs-x86_64-posix-seh-gcc-16.2.0-mingw-w64msvcrt-14.0.0-r1.7z"
WORK="$HOME/.workbuddy"
ARC="$WORK/mingw64.7z"
MIN_GZ=108000000   # 105 MiB compressed archive is ~110MB; require >=108MB before trusting
LOG="$WORK/mingw-dl.log"
PY="$HOME/.workbuddy/binaries/python/envs/default/bin/python"

ts(){ date '+%H:%M:%S'; }
log(){ echo "[$(ts)] $*" | tee -a "$LOG"; }

mkdir -p "$WORK"
log "=== resilient mingw downloader start ==="
log "target archive size threshold: $MIN_GZ bytes"

for i in $(seq 1 40); do
  SZ=$(stat -c%s "$ARC" 2>/dev/null || echo 0)
  log "attempt $i: current size=$SZ bytes"
  if [ "$SZ" -ge "$MIN_GZ" ]; then
    log "size already >= threshold, skipping download"
    break
  fi
  # -C - : resume; --retry-all-errors : retry even on connection drops; -f : fail on HTTP error
  curl -fL -C - --retry 10 --retry-delay 3 --retry-all-errors -o "$ARC" "$URL" 2>>"$LOG"
  RC=$?
  SZ=$(stat -c%s "$ARC" 2>/dev/null || echo 0)
  log "curl exit=$RC size_now=$SZ bytes"
  if [ "$SZ" -ge "$MIN_GZ" ]; then
    log "download complete (size ok)"
    break
  fi
  # transient drop: loop will resume from $SZ
  sleep 2
done

SZ=$(stat -c%s "$ARC" 2>/dev/null || echo 0)
if [ "$SZ" -lt "$MIN_GZ" ]; then
  log "FAILED: only $SZ bytes after 40 attempts"
  exit 1
fi

# integrity check via py7zr (does not extract yet)
log "verifying archive integrity..."
"$PY" - <<'PYEOF' >>"$LOG" 2>&1
import py7zr, sys
try:
    with py7zr.SevenZipFile(r"C:/Users/weiwq/.workbuddy/mingw64.7z", 'r') as z:
        bad = z.testzip()
    print("integrity OK" if bad is None else f"integrity BAD: {bad}")
    sys.exit(0 if bad is None else 2)
except Exception as e:
    print("integrity check error:", e); sys.exit(3)
PYEOF
if [ $? -ne 0 ]; then log "archive integrity FAILED"; exit 1; fi

# extract
log "extracting to $WORK/mingw64 ..."
"$PY" - <<'PYEOF' >>"$LOG" 2>&1
import py7zr
with py7zr.SevenZipFile(r"C:/Users/weiwq/.workbuddy/mingw64.7z", 'r') as z:
    z.extractall(path=r"C:/Users/weiwq/.workbuddy/mingw64")
print("extracted")
PYEOF

WINDRES=$(ls "$WORK"/mingw64/bin/windres.exe 2>/dev/null || true)
if [ -z "$WINDRES" ]; then
  log "FAILED: windres.exe not found after extract"
  exit 1
fi
log "TOOLCHAIN READY: $WINDRES"
log "=== done ==="
