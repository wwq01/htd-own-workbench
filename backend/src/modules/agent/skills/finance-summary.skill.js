/**
 * 技能：财务收支汇总（finance-summary）
 * 统计全量/本月收入、支出、结余与分类明细。纯本地只读、不联网。
 *
 * 注意：finance_records.date 为 DateTime 列，按全库约定落 BIGINT 存储，
 * 因此区间过滤必须用「时间戳数值比较」，不能用 YYYY-MM-DD 字符串比较。
 */
import { countTable, todayStr } from './util.js';
import { formatDate, startOfMonth } from '../../../common/utils/date.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** 按 type 分组聚合金额；异常降级为 0，不影响整体 */
async function sumByType(prisma, extraWhere = '') {
  const where = '"deletedAt" IS NULL' + (extraWhere ? ` AND ${extraWhere}` : '');
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT type, SUM(amount) as total, COUNT(*) as cnt FROM "finance_records" WHERE ${where} GROUP BY type`,
    );
    const out = { INCOME: 0, EXPENSE: 0, count: 0 };
    for (const r of rows || []) {
      out[r.type] = round2(r.total);
      out.count += Number(r.cnt || 0);
    }
    return out;
  } catch {
    return { INCOME: 0, EXPENSE: 0, count: 0 };
  }
}

export default {
  key: 'finance-summary',
  title: '财务收支汇总',
  description: '统计总收入/总支出/结余、本月收支与支出分类明细',
  // 避开已被占用的关键字：'汇总'(weekly-report)、'任务'(todo-extract)、'统计'(原 db-health，已移除)
  keywords: ['财务', '收支', '收入', '支出', '记账', '消费', '结余', 'finance'],
  async run({ prisma }) {
    const monthStartTs = startOfMonth(new Date()).getTime();

    const all = await sumByType(prisma);
    const month = await sumByType(prisma, `"date" >= ${monthStartTs}`);

    // 支出分类明细（降序）
    let expenseByCategory = [];
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT category, SUM(amount) as total FROM "finance_records"
         WHERE "deletedAt" IS NULL AND type = 'EXPENSE'
         GROUP BY category ORDER BY total DESC`,
      );
      expenseByCategory = (rows || []).map((r) => ({
        category: r.category,
        total: round2(r.total),
      }));
    } catch {
      expenseByCategory = [];
    }

    // 最近 5 笔流水
    let recent = [];
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT type, amount, category, remark, "date" FROM "finance_records"
         WHERE "deletedAt" IS NULL ORDER BY "date" DESC LIMIT 5`,
      );
      recent = (rows || []).map((r) => ({
        type: r.type,
        amount: round2(r.amount),
        category: r.category,
        remark: r.remark || '',
        date: formatDate(new Date(Number(r.date))),
      }));
    } catch {
      recent = [];
    }

    const totalRecords = await countTable(prisma, 'finance_records');

    return {
      totalRecords,
      totalIncome: all.INCOME,
      totalExpense: all.EXPENSE,
      balance: round2(all.INCOME - all.EXPENSE),
      monthIncome: month.INCOME,
      monthExpense: month.EXPENSE,
      monthBalance: round2(month.INCOME - month.EXPENSE),
      monthCount: month.count,
      expenseByCategory,
      recent,
      monthRange: `${formatDate(startOfMonth(new Date()))} ~ ${todayStr()}`,
      note: '本地确定性财务汇总：基于本机 SQLite finance_records 统计，未联网。',
    };
  },
};
