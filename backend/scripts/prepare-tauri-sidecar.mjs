#!/usr/bin/env node
/**
 * S3-1 · 准备 Tauri sidecar 二进制
 *
 * 把 pkg 打好的单文件后端（build/荒天帝工作台.exe）复制并重命名为
 * Tauri externalBin 要求的命名：
 *
 *   src-tauri/binaries/htd-backend-<target-triple>[.exe]
 *
 * 为什么必须带 target triple：Tauri 要求 externalBin 声明的路径下存在
 * 「同名 + -$TARGET_TRIPLE 后缀」的可执行文件，否则打包阶段直接失败。
 * 顺带解决了产物文件名含中文的问题。
 *
 * 用法：
 *   node backend/scripts/prepare-tauri-sidecar.mjs [--input <path>] [--triple <triple>]
 *
 * 未安装 Rust 时也能跑：target triple 会回落到平台默认值（仅用于准备文件，
 * 真正打包前建议装好 rustc 以取得准确的 host-tuple）。
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const SIDECAR_NAME = 'htd-backend';
const OUT_DIR = path.join(repoRoot, 'src-tauri', 'binaries');

function parseArgs(argv) {
  const args = { input: null, triple: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--input') args.input = argv[i + 1];
    if (argv[i] === '--triple') args.triple = argv[i + 1];
  }
  return args;
}

/** 平台回落值：无 rustc 时使用 */
function fallbackTriple() {
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
  if (process.platform === 'win32') return `${arch}-pc-windows-msvc`;
  if (process.platform === 'darwin') return `${arch}-apple-darwin`;
  return `${arch}-unknown-linux-gnu`;
}

function detectTriple() {
  try {
    const out = execSync('rustc --print host-tuple', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (out) return { triple: out, source: 'rustc' };
  } catch (error) {
    // 未安装 Rust 或命令不可用
  }
  return { triple: fallbackTriple(), source: 'fallback' };
}

function defaultInput() {
  return process.platform === 'win32'
    ? path.join(repoRoot, 'build', '荒天帝工作台.exe')
    : path.join(repoRoot, 'build', '荒天帝工作台-macos');
}

function main() {
  const args = parseArgs(process.argv);
  const input = path.resolve(args.input || defaultInput());
  const { triple, source } = args.triple
    ? { triple: args.triple, source: '--triple' }
    : detectTriple();

  if (!fs.existsSync(input)) {
    console.error(`[prepare-tauri-sidecar] 找不到 pkg 产物：${input}`);
    console.error('请先构建单文件后端：');
    console.error('  cd backend && npm run build:win   # Windows');
    console.error('  cd backend && npm run build:mac   # macOS');
    process.exit(1);
  }

  const ext = process.platform === 'win32' ? '.exe' : '';
  const outFile = path.join(OUT_DIR, `${SIDECAR_NAME}-${triple}${ext}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.copyFileSync(input, outFile);

  // macOS/Linux 需要可执行位
  if (process.platform !== 'win32') {
    fs.chmodSync(outFile, 0o755);
  }

  const sizeMb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
  console.log(`[prepare-tauri-sidecar] target triple: ${triple}（来源：${source}）`);
  console.log(`[prepare-tauri-sidecar] 已生成 ${path.relative(repoRoot, outFile)}（${sizeMb} MB）`);
  if (source === 'fallback') {
    console.warn('[prepare-tauri-sidecar] 警告：未检测到 rustc，triple 为平台回落值。');
    console.warn('  正式打包前请安装 Rust 工具链后重跑本脚本，确保 triple 与实际构建目标一致。');
  }
}

main();
