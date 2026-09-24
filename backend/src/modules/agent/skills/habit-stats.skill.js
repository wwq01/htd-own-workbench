/**
 * 技能：习惯打卡统计（habit-stats）
 * 统计习惯总数、今日/本周打卡次数、各习惯连续天数。纯本地只读、不联网。
 */
import { countTable, todayStr, weekStartStr } from './util.js';

export default {
  key: 'habit-stats',
  title: '习惯打卡统计',
  description: '统计习惯总数、今日/本周打卡次数、各习惯连续天数',
  keywords: ['习惯', 'habit', '打卡', '连续', '坚持', 'streak', '完成率'],
  async run({ prisma }) {
    const today = todayStr();
    const ws = weekStartStr();

    const habits = await prisma.$queryRawUnsafe(
      `SELECT id, name, frequency FROM "habits" WHERE "deletedAt" IS NULL`,
    );
    const checkins = await prisma.$queryRawUnsafe(
      `SELECT "habitId", date, count FROM "habit_checkins" WHERE "deletedAt" IS NULL AND date >= '${ws}'`,
    );

    const byHabit = {};
    for (const c of checkins || []) {
      const id = c.habitId;
      if (!byHabit[id]) byHabit[id] = { count: 0, dates: new Set() };
      byHabit[id].count += Number(c.count || 1);
      byHabit[id].dates.add(c.date);
    }

    const todayRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as c FROM "habit_checkins" WHERE "deletedAt" IS NULL AND date = '${today}'`,
    );
    const todayCheckIns = Number(todayRows[0]?.c || 0);

    const perHabit = (habits || []).map((h) => ({
      name: h.name,
      frequency: h.frequency,
      thisWeekCount: byHabit[h.id]?.count || 0,
      streak: computeStreak(byHabit[h.id]?.dates || new Set(), today),
    }));

    const weekCheckIns = Object.values(byHabit).reduce((s, a) => s + a.count, 0);
    const maxStreak = perHabit.reduce((m, h) => Math.max(m, h.streak), 0);

    return {
      totalHabits: await countTable(prisma, 'habits'),
      todayCheckIns,
      weekCheckIns,
      maxStreak,
      perHabit,
      weekRange: `${ws} ~ ${today}`,
    };
  },
};

/**
 * 计算连续打卡天数：从今天往回数，遇到缺失日停止。
 * 今天未打卡但昨天有，则 streak 保持（从昨天起算）。
 * @param {Set<string>} dateSet 已打卡日期集合（YYYY-MM-DD）
 * @param {string} todayStr 今天 YYYY-MM-DD
 */
function computeStreak(dateSet, todayStr) {
  const [y, m, d] = todayStr.split('-').map(Number);
  const cur = new Date(y, m - 1, d);
  if (!dateSet.has(todayStr)) cur.setDate(cur.getDate() - 1); // 今天还没打卡，从昨天算
  let streak = 0;
  while (dateSet.has(fmt(cur))) {
    streak += 1;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

function fmt(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
