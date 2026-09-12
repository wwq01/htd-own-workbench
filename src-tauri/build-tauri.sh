#!/usr/bin/env bash
# S3-1 · 真机编译脚本（GNU target，无需 VS / MSVC / Windows SDK）
#
# 前置（本机已具备）：
#   - MinGW-w64 7z 已下载到 $USERPROFILE/.workbuddy/mingw64.7z
#     （GNU target 编译 Windows 资源必须 windres/gcc/ar/ld）
#   - Rust stable (x86_64-pc-windows-gnu) 已装（rustup 默认安装）
#   - ~/.cargo/config.toml 已配 rsproxy.cn 镜像，依赖下载走国内加速
#
# 用法（Git Bash）：
#   bash src-tauri/build-tauri.sh
#
# 说明：
#   - 仅做「骨架能否编译通过」的验证。externalBin 会嵌入已有的占位 sidecar
#     （src-tauri/binaries/htd-backend-x86_64-pc-windows-gnu.exe，合法 PE），
#     因此无需先 pkg 打包真实后端。
#   - 生产打包（tauri build）前请先 `cd backend && npm run build:win` 生成真实
#     单文件后端，再用 `node backend/scripts/prepare-tauri-sidecar.mjs --strict`
#     覆盖 sidecar，最后 `tauri build`。
set -euo pipefail

MINGW_7Z="$USERPROFILE/.workbuddy/mingw64.7z"
MINGW_DIR="$USERPROFILE/.workbuddy/mingw64"

# 1) 首次解压 MinGW-w64（用已装好的 managed Python + py7zr，避免污染项目）
if [ ! -x "$MINGW_DIR/bin/windres.exe" ]; then
  echo "== 解压 MinGW-w64 (py7zr) =="
  PY="$USERPROFILE/.workbuddy/binaries/python/envs/default/Scripts/python.exe"
  "$PY" - "$MINGW_7Z" "$MINGW_DIR" <<'PYEOF'
import sys, py7zr
src, dest = sys.argv[1], sys.argv[2]
print("extracting", src, "->", dest)
with py7zr.SevenZipFile(src, "r") as z:
    z.extractall(path=dest)
print("done")
PYEOF
fi

# 2) 工具链进 PATH（windres/gcc 来自 MinGW，cargo 来自 rustup）
export PATH="$MINGW_DIR/bin:$USERPROFILE/.cargo/bin:$PATH"
command -v windres >/dev/null 2>&1 || { echo "ERROR: windres 未找到"; exit 1; }
command -v cargo   >/dev/null 2>&1 || { echo "ERROR: cargo 未找到（请先装 Rust）"; exit 1; }
echo "windres: $(command -v windres)"
echo "cargo:   $(cargo --version)"

# 3) 编译 S3-1 骨架（依赖经 rsproxy.cn 镜像；首次编译含 Tauri 全家桶，约 20-60 分钟）
cd "$(dirname "$0")"
echo "== cargo build (S3-1 骨架) =="
cargo build 2>&1 | tee "$USERPROFILE/.workbuddy/tauri-build.log"
echo "DONE -> src-tauri/target/debug/htd-own-workbench.exe"
