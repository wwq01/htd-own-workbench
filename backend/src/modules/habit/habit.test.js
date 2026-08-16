import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import habitService from './habit.service.js';
import { HABIT_FREQUENCY } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';

function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function cleanup() {
  const habits = await prisma.habit.findMany({ where: { name: { contains: PREFIX } }, select: { id: true } });
  const ids = habits.map((h) => h.id);
  if (ids.length) {
    await prisma.habitCheckIn.deleteMany({ where: { habitId: { in: ids } } });
  }
  await prisma.habit.deleteMany({ where: { name: { contains: PREFIX } } });
}

describe('Habit Service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('createHabit 成功写入默认 DAILY', async () => {
    const h = await habitService.createHabit({ name: `${PREFIX}晨跑`, frequency: HABIT_FREQUENCY.DAILY });
    expect(h.id).toBeTruthy();
    expect(h.frequency).toBe(HABIT_FREQUENCY.DAILY);
    expect(h.dailyTargetCount).toBe(1);
  });

  it('createHabit 名称为空抛错', async () => {
    await expect(habitService.createHabit({ name: '' })).rejects.toThrow('习惯名称不能为空');
  });

  it('createHabit WEEKLY 缺每周目标天数抛错', async () => {
    await expect(habitService.createHabit({ name: `${PREFIX}周读`, frequency: HABIT_FREQUENCY.WEEKLY }))
      .rejects.toThrow('周习惯必须设置每周目标天数且 >= 1');
  });

  it('updateHabit 切到 WEEKLY 维护 weeklyTargetDays', async () => {
    const h = await habitService.createHabit({ name: `${PREFIX}切换`, frequency: HABIT_FREQUENCY.DAILY });
    const upd = await habitService.updateHabit(h.id, { frequency: HABIT_FREQUENCY.WEEKLY, weeklyTargetDays: 3 });
    expect(upd.frequency).toBe(HABIT_FREQUENCY.WEEKLY);
    expect(upd.weeklyTargetDays).toBe(3);
  });

  it('checkIn 同日期幂等累加', async () => {
    const h = await habitService.createHabit({ name: `${PREFIX}打卡`, frequency: HABIT_FREQUENCY.DAILY });
    await habitService.checkIn(h.id, '2026-08-01', 1);
    const upd = await habitService.checkIn(h.id, '2026-08-01', 2);
    expect(upd.count).toBe(3);
    const all = await habitService.listCheckIns(h.id, '2026-08');
    expect(all.length).toBe(1);
  });

  it('listCheckIns 按月份过滤', async () => {
    const h = await habitService.createHabit({ name: `${PREFIX}月度`, frequency: HABIT_FREQUENCY.DAILY });
    await habitService.checkIn(h.id, '2026-08-15', 1);
    await habitService.checkIn(h.id, '2026-09-15', 1);
    const aug = await habitService.listCheckIns(h.id, '2026-08');
    expect(aug.length).toBe(1);
    expect(aug[0].date).toBe('2026-08-15');
  });

  it('getStats longestStreak 求最长连续天数', async () => {
    const h = await habitService.createHabit({ name: `${PREFIX}连续`, frequency: HABIT_FREQUENCY.DAILY });
    for (const d of ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-10']) {
      await habitService.checkIn(h.id, d, 1);
    }
    const stats = await habitService.getStats(h.id);
    expect(stats.longestStreak).toBe(3);
  });

  it('getStats currentStreak 从今天往回数', async () => {
    const h = await habitService.createHabit({ name: `${PREFIX}今日`, frequency: HABIT_FREQUENCY.DAILY });
    const todayStr = fmt(new Date());
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yStr = fmt(y);
    await habitService.checkIn(h.id, todayStr, 1);
    await habitService.checkIn(h.id, yStr, 1);
    const stats = await habitService.getStats(h.id);
    expect(stats.currentStreak).toBe(2);
  });

  it('deleteHabit 软删除', async () => {
    const h = await habitService.createHabit({ name: `${PREFIX}删`, frequency: HABIT_FREQUENCY.DAILY });
    await habitService.deleteHabit(h.id);
    const raw = await prisma.habit.findUnique({ where: { id: h.id } });
    expect(raw.deletedAt).not.toBeNull();
  });
});

afterAll(async () => { await prisma.$disconnect(); });
