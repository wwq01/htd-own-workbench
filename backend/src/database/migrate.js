/**
 * 运行时 Schema 对齐（幂等迁移）
 *
 * 背景：应用启动时有两种情况
 *  1. 全新库：bootstrap 从 prisma/template.db 拷贝，已含全部表
 *  2. 已存在的老库（如用户升级前的 workbench.db）：只包含旧表，
 *     不会自动获得 V1.3 新增的表 / 新列
 *
 * 本模块在数据库连接成功后执行一次幂等 DDL，确保运行中的真实库
 * 与当前 schema 对齐：缺失的表 CREATE TABLE IF NOT EXISTS，
 * 缺失的列 ALTER TABLE ADD COLUMN。类型与 build-template-db.mjs
 * （sql.js 从 schema.prisma 生成的 template.db）保持一致：
 *   DateTime → BIGINT（Prisma 在 SQLite 中以毫秒时间戳存储）
 *   Int / Boolean → INTEGER；Float / Decimal → REAL；其余 → TEXT
 *
 * 设计原则：仅追加，绝不 DROP / 改列类型，保证老数据安全。
 */
import prisma from './prisma.js';
import logger from '../common/logger.js';

// 新表 DDL（与 build-template-db.mjs 输出逐列对齐）
const TABLE_DDL = [
  `CREATE TABLE IF NOT EXISTS "meetings" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT,
    "heldAt" BIGINT,
    "participants" TEXT,
    "agenda" TEXT,
    "decisions" TEXT,
    "actionItems" TEXT,
    "relatedProjectId" TEXT,
    "reviewId" TEXT,
    "createdAt" BIGINT,
    "updatedAt" BIGINT,
    "deletedAt" BIGINT
  );`,
  `CREATE TABLE IF NOT EXISTS "habits" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT,
    "frequency" TEXT,
    "weeklyTargetDays" INTEGER,
    "dailyTargetCount" INTEGER,
    "remark" TEXT,
    "icon" TEXT,
    "createdAt" BIGINT,
    "updatedAt" BIGINT,
    "deletedAt" BIGINT
  );`,
  `CREATE TABLE IF NOT EXISTS "habit_checkins" (
    "id" TEXT PRIMARY KEY,
    "habitId" TEXT,
    "date" TEXT,
    "count" INTEGER,
    "note" TEXT,
    "createdAt" BIGINT,
    "updatedAt" BIGINT,
    "deletedAt" BIGINT
  );`,
  `CREATE TABLE IF NOT EXISTS "time_blocks" (
    "id" TEXT PRIMARY KEY,
    "startedAt" BIGINT,
    "endedAt" BIGINT,
    "plannedMinutes" INTEGER,
    "actualMinutes" INTEGER,
    "type" TEXT,
    "relatedProjectId" TEXT,
    "relatedStudyId" TEXT,
    "note" TEXT,
    "interrupted" INTEGER,
    "createdAt" BIGINT,
    "updatedAt" BIGINT,
    "deletedAt" BIGINT
  );`,
  `CREATE TABLE IF NOT EXISTS "finance_records" (
    "id" TEXT PRIMARY KEY,
    "date" BIGINT,
    "type" TEXT,
    "amount" REAL,
    "category" TEXT,
    "subCategory" TEXT,
    "relatedClientId" TEXT,
    "remark" TEXT,
    "tags" TEXT,
    "createdAt" BIGINT,
    "updatedAt" BIGINT,
    "deletedAt" BIGINT
  );`,
  `CREATE TABLE IF NOT EXISTS "contract_receivables" (
    "id" TEXT PRIMARY KEY,
    "contractNo" TEXT,
    "contractAmount" REAL,
    "clientName" TEXT,
    "nodes" TEXT,
    "totalReceived" REAL,
    "totalPending" REAL,
    "remark" TEXT,
    "createdAt" BIGINT,
    "updatedAt" BIGINT,
    "deletedAt" BIGINT
  );`,
  `CREATE TABLE IF NOT EXISTS "vault_items" (
    "id" TEXT PRIMARY KEY,
    "topic" TEXT,
    "content" TEXT,
    "tags" TEXT,
    "status" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "createdAt" BIGINT,
    "updatedAt" BIGINT,
    "deletedAt" BIGINT
  );`,
  `CREATE TABLE IF NOT EXISTS "project_phase_transitions" (
    "id" TEXT PRIMARY KEY,
    "projectId" TEXT,
    "fromPhase" TEXT,
    "toPhase" TEXT,
    "reason" TEXT,
    "createdAt" BIGINT,
    "createdBy" TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS "poc_trackings" (
    "id" TEXT PRIMARY KEY,
    "goal" TEXT,
    "environment" TEXT,
    "customerParticipants" TEXT,
    "result" TEXT,
    "status" TEXT,
    "projectId" TEXT,
    "sortOrder" INTEGER,
    "createdAt" BIGINT,
    "updatedAt" BIGINT,
    "deletedAt" BIGINT
  );`,
  `CREATE TABLE IF NOT EXISTS "bid_archives" (
    "id" TEXT PRIMARY KEY,
    "bidNo" TEXT,
    "deadline" TEXT,
    "bidVersion" TEXT,
    "bidResult" TEXT,
    "status" TEXT,
    "projectMilestoneId" TEXT,
    "sortOrder" INTEGER,
    "createdAt" BIGINT,
    "updatedAt" BIGINT,
    "deletedAt" BIGINT
  );`,
  `CREATE TABLE IF NOT EXISTS "vuln_tracks" (
    "id" TEXT PRIMARY KEY,
    "assetGroup" TEXT,
    "vulnId" TEXT,
    "affectedProduct" TEXT,
    "exploitMethod" TEXT,
    "reproduction" TEXT,
    "fixStatus" TEXT,
    "severity" TEXT,
    "sortOrder" INTEGER,
    "createdAt" BIGINT,
    "updatedAt" BIGINT,
    "deletedAt" BIGINT
  );`,
  `CREATE TABLE IF NOT EXISTS "emergency_responses" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT,
    "eventTimeline" TEXT,
    "responseActions" TEXT,
    "review" TEXT,
    "status" TEXT,
    "severity" TEXT,
    "sortOrder" INTEGER,
    "createdAt" BIGINT,
    "updatedAt" BIGINT,
    "deletedAt" BIGINT
  );`,
  `CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" TEXT PRIMARY KEY,
    "key" TEXT UNIQUE NOT NULL,
    "value" TEXT DEFAULT '{}',
    "updatedAt" BIGINT
  );`,
];

// 老表新增列（缺失才加）
const COLUMN_ALTERS = [
  { table: 'reviews', column: 'status', type: 'TEXT' },
  { table: 'todos', column: 'delayedUntil', type: 'BIGINT' },
  { table: 'reviews', column: 'vaultSourceType', type: 'TEXT' },
];

async function tableHasColumn(table, column) {
  const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
  return Array.isArray(rows) && rows.some((r) => r.name === column);
}

/**
 * 执行幂等 Schema 对齐。任何单条失败都不影响其余，仅记录日志。
 */
export async function ensureSchema() {
  let created = 0;
  let altered = 0;
  for (const ddl of TABLE_DDL) {
    try {
      await prisma.$executeRawUnsafe(ddl);
      created += 1;
    } catch (err) {
      logger.error(`[migrate] 建表失败被忽略: ${err.message}`);
    }
  }
  for (const { table, column, type } of COLUMN_ALTERS) {
    try {
      const exists = await tableHasColumn(table, column);
      if (!exists) {
        await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`);
        altered += 1;
        logger.info(`[migrate] 已为 ${table} 新增列 ${column}`);
      }
    } catch (err) {
      logger.error(`[migrate] 加列失败被忽略(${table}.${column}): ${err.message}`);
    }
  }
  if (created || altered) {
    logger.info(`[migrate] Schema 对齐完成：检查建表 ${TABLE_DDL.length} 项，补列 ${altered} 项`);
  }
  return { tablesChecked: TABLE_DDL.length, columnsAdded: altered };
}

export default ensureSchema;
