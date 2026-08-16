import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import timeBlockService from './time-block.service.js';
import { TIME_BLOCK_TYPE } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';

// 格式化为 YYYY-MM-DDTHH:mm:ss（本地时间，不含毫秒/Z），满足 ISO_DATETIME_REGEX
function isoLocal(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

describe('TimeBlock Service', () => {
  beforeEach(async () => {
    await prisma.timeBlock.deleteMany({ where: { note: { contains: PREFIX } } });
  });
  afterEach(async () => {
    await prisma.timeBlock.deleteMany({ where: { note: { contains: PREFIX } } });
  });

  it('create 补录成功', async () => {
    const now = isoLocal(new Date());
    const b = await timeBlockService.create({ startedAt: now, endedAt: now, type: TIME_BLOCK_TYPE.WORK, note: `${PREFIX}补录`, actualMinutes: 25 });
    expect(b.id).toBeTruthy();
    expect(b.type).toBe(TIME_BLOCK_TYPE.WORK);
  });

  it('start 番茄钟启动：endedAt 空、actualMinutes 0', async () => {
    const b = await timeBlockService.start({ type: TIME_BLOCK_TYPE.WORK, note: `${PREFIX}番茄` });
    expect(b.endedAt).toBeNull();
    expect(b.actualMinutes).toBe(0);
    expect(b.interrupted).toBe(false);
  });

  it('stop 计算实际时长分钟', async () => {
    const past = new Date(Date.now() - 30 * 60 * 1000);
    const b = await timeBlockService.create({ startedAt: isoLocal(past), type: TIME_BLOCK_TYPE.WORK, note: `${PREFIX}计时` });
    const stopped = await timeBlockService.stop(b.id, { interrupted: false });
    expect(stopped.endedAt).not.toBeNull();
    expect(stopped.actualMinutes).toBeGreaterThanOrEqual(29);
    expect(stopped.actualMinutes).toBeLessThanOrEqual(31);
  });

  it('update 部分更新', async () => {
    const b = await timeBlockService.create({ startedAt: isoLocal(new Date()), type: TIME_BLOCK_TYPE.WORK, note: `${PREFIX}改` });
    const upd = await timeBlockService.update(b.id, { type: TIME_BLOCK_TYPE.STUDY, actualMinutes: 50 });
    expect(upd.type).toBe(TIME_BLOCK_TYPE.STUDY);
    expect(upd.actualMinutes).toBe(50);
  });

  it('getStats 聚合 byType 与 totalToday', async () => {
    const now = isoLocal(new Date());
    await timeBlockService.create({ startedAt: now, endedAt: now, actualMinutes: 25, type: TIME_BLOCK_TYPE.WORK, note: `${PREFIX}s1` });
    await timeBlockService.create({ startedAt: now, endedAt: now, actualMinutes: 15, type: TIME_BLOCK_TYPE.STUDY, note: `${PREFIX}s2` });
    const stats = await timeBlockService.getStats();
    const work = stats.byType.find((t) => t.type === TIME_BLOCK_TYPE.WORK);
    const study = stats.byType.find((t) => t.type === TIME_BLOCK_TYPE.STUDY);
    expect(work.minutes).toBe(25);
    expect(study.minutes).toBe(15);
    expect(stats.totalToday).toBe(40);
  });

  it('delete 软删除', async () => {
    const b = await timeBlockService.create({ startedAt: isoLocal(new Date()), type: TIME_BLOCK_TYPE.WORK, note: `${PREFIX}删` });
    await timeBlockService.delete(b.id);
    const raw = await prisma.timeBlock.findUnique({ where: { id: b.id } });
    expect(raw.deletedAt).not.toBeNull();
  });
});

afterAll(async () => { await prisma.$disconnect(); });
