/**
 * 技能共用数据库工具（只读）
 * 直接走 Prisma 原始查询，避免与具体模型耦合；单表异常不影响整体。
 */

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
