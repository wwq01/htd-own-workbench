/**
 * 技能共用数据库工具（只读）
 * 直接走 Prisma 原始查询，避免与具体模型耦合；单表异常不影响整体。
 */
import { formatDate, startOfWeek } from '../../../common/utils/date.js';

/**
 * 统计某表有效行数（带软删除保护的表自动过滤 deletedAt）
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} table 物理表名
 * @param {boolean} soft 是否按 deletedAt IS NULL 过滤
 */
export async function countTable(prisma, table, soft = true) {
  const where = soft ? ' WHERE deletedAt IS NULL' : '';
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "${table}"${where}`);
    return Number(rows[0]?.c || 0);
  } catch {
    return 0;
  }
}

/**
 * 取某表最近更新的标题列表
 */
export async function recentTitles(prisma, table, titleCol = 'title', limit = 5) {
  const n = Number(limit) || 5;
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT "${titleCol}" FROM "${table}" WHERE deletedAt IS NULL ORDER BY updatedAt DESC LIMIT ${n}`,
    );
    return (rows || []).map((r) => r[titleCol]).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * 本周一 00:00 的时间戳（毫秒，与本库 BIGINT 存储的 DateTime 列对齐）
 */
export function weekStartTs() {
  return startOfWeek(new Date()).getTime();
}

/**
 * 今天 YYYY-MM-DD（本地时间，遵循项目日期格式化约定 #2）
 */
export function todayStr() {
  return formatDate(new Date());
}

/**
 * 本周一 YYYY-MM-DD（本地时间），用于 date 列字符串比较
 */
export function weekStartStr() {
  return formatDate(startOfWeek(new Date()));
}

/**
 * 统计自某时间戳以来新增的行数（默认按 createdAt；可指定 timeCol）
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} table 物理表名（硬编码常量，非用户输入）
 * @param {number} sinceTs 起始时间戳（毫秒）
 * @param {string} timeCol 时间列名，默认 createdAt
 * @param {boolean} soft 是否按 deletedAt IS NULL 过滤
 */
export async function countSince(prisma, table, sinceTs, timeCol = 'createdAt', soft = true) {
  const where = `"${timeCol}" >= ${Number(sinceTs)}` + (soft ? ' AND "deletedAt" IS NULL' : '');
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "${table}" WHERE ${where}`);
    return Number(rows[0]?.c || 0);
  } catch {
    return 0;
  }
}
