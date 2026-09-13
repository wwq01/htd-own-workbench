/**
 * V2-1 最小侵入补表：为活跃库追加 agent_tasks 表
 *
 * 遵循项目数据库红线：
 *   1. 改动前先备份（复制为 .bak-<时间戳>-before-agent）
 *   2. 仅 CREATE TABLE IF NOT EXISTS，绝不触碰既有表、绝不用 prisma db push
 *   3. 列类型与 build-template-db.mjs 生成的 agent_tasks 完全一致
 *      （DateTime 一律落成 BIGINT，与全库其它 30 张表保持一致）
 *
 * 用法：
 *   node backend/scripts/migrate-agent.mjs
 *   可选环境变量：HTD_DATA_ROOT（覆盖 dataRoot）/ HTD_SETTINGS_PATH（覆盖 settings.json 路径）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');

function resolveActiveDb() {
  const settingsPath = process.env.HTD_SETTINGS_PATH
    || path.join(process.env.HTD_DATA_ROOT || 'D:/htd-own-workbench-log', 'settings.json');
  let dataRoot = process.env.HTD_DATA_ROOT;
  if (!dataRoot && fs.existsSync(settingsPath)) {
    try {
      dataRoot = JSON.parse(fs.readFileSync(settingsPath, 'utf8')).dataRoot;
    } catch { /* ignore */ }
  }
  if (!dataRoot) dataRoot = 'D:/htd-own-workbench-log';
  const dataDir = path.join(dataRoot, 'data');
  if (!fs.existsSync(dataDir)) throw new Error(`未找到数据目录：${dataDir}`);
  const dbs = fs.readdirSync(dataDir).filter((f) => f.endsWith('.db'));
  if (!dbs.length) throw new Error(`数据目录下无 .db 文件：${dataDir}`);
  const target = dbs.includes('workbench.db') ? 'workbench.db' : dbs[0];
  return path.join(dataDir, target);
}

const dbPath = resolveActiveDb();
console.log(`[migrate-agent] 活跃库：${dbPath}`);

// 1) 备份
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const bak = `${dbPath}.bak-${ts}-before-agent`;
fs.copyFileSync(dbPath, bak);
console.log(`[migrate-agent] 已备份：${bak}`);

// 2) 指向活跃库并建表
process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, '/')}`;
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const DDL = `CREATE TABLE IF NOT EXISTS "agent_tasks" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT,
  "prompt" TEXT,
  "skillKey" TEXT,
  "status" TEXT,
  "result" TEXT,
  "error" TEXT,
  "startedAt" BIGINT,
  "finishedAt" BIGINT,
  "createdAt" BIGINT,
  "updatedAt" BIGINT,
  "deletedAt" BIGINT
);`;

try {
  await prisma.$executeRawUnsafe(DDL);
  const cols = await prisma.$queryRawUnsafe('PRAGMA table_info("agent_tasks")');
  const hasStatusIndex = await prisma.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='agent_tasks' AND name='agent_tasks_status_idx'",
  );
  if (!hasStatusIndex.length) {
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "agent_tasks_status_idx" ON "agent_tasks" ("status")');
  }
  console.log(`[migrate-agent] 建表成功，字段数：${cols.length}，状态索引已就绪`);
} catch (e) {
  console.error('[migrate-agent] 建表失败：', e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
