#!/usr/bin/env node
/**
 * check-schemas.mjs — schema / 枚举 / 状态机 可加载性校验（typecheck 门禁）
 *
 * 动态 import backend/src 下所有匹配模块：
 *   - *.schema.js
 *   - *enum*.js
 *   - *state[-_]machine*.js
 * 确认它们能无错加载（捕获语法错误 / 循环依赖 / 顶层副作用异常）。
 * 排除 *.test.js（测试文件不应作为加载校验对象）。失败即非零退出。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '../src');

const PATTERNS = [
  /\.schema\.js$/i,
  /enum.*\.js$/i,
  /state[-_]?machine.*\.js$/i,
];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fp, acc);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.test.js')) continue; // 排除测试文件
      if (PATTERNS.some((re) => re.test(entry.name))) acc.push(fp);
    }
  }
  return acc;
}

const results = [];
let failed = 0;

async function main() {
  const files = walk(SRC_DIR);
  for (const fp of files) {
    try {
      await import(pathToFileURL(fp).href);
      results.push({ file: path.relative(SRC_DIR, fp), ok: true });
    } catch (e) {
      failed += 1;
      results.push({ file: path.relative(SRC_DIR, fp), ok: false, error: e && e.message ? e.message : String(e) });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  console.log(`[check-schemas] 加载 ${results.length} 个模块：${okCount} 成功 / ${failed} 失败`);
  for (const r of results) {
    if (!r.ok) console.error(`  [FAIL] ${r.file}: ${r.error}`);
  }

  if (failed > 0) {
    console.error('[check-schemas] 失败：存在无法加载的 schema/枚举/状态机模块');
    process.exit(1);
  }
  console.log('[check-schemas] 通过：全部 schema / 枚举 / 状态机可加载');
  process.exit(0);
}

main();
