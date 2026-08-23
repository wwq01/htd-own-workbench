import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bidService from './bid.service.js';
import { BID_STATUS, BID_RESULT } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';

async function cleanup() {
  await prisma.bidArchive.deleteMany({ where: { bidNo: { contains: PREFIX } } });
}

describe('Bid Service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('create 必填 bidNo，默认 bidResult=pending/status=draft', async () => {
    const b = await bidService.create({ bidNo: `${PREFIX}BID-001` });
    expect(b.id).toBeTruthy();
    expect(b.bidResult).toBe(BID_RESULT.PENDING);
    expect(b.status).toBe(BID_STATUS.DRAFT);
    expect(b.deletedAt).toBeUndefined();
  });

  it('create bidNo 为空抛错', async () => {
    await expect(bidService.create({ bidNo: '' })).rejects.toThrow();
  });

  it('create 重复 bidNo 抛错(唯一约束)', async () => {
    await bidService.create({ bidNo: `${PREFIX}DUP` });
    await expect(bidService.create({ bidNo: `${PREFIX}DUP` })).rejects.toThrow();
  });

  it('getById 不存在抛错', async () => {
    await expect(bidService.getById('nope')).rejects.toThrow('投标档案不存在');
  });

  it('list 按 milestoneId 软关联过滤', async () => {
    await bidService.create({ bidNo: `${PREFIX}M1`, projectMilestoneId: 'ms-1' });
    await bidService.create({ bidNo: `${PREFIX}M2`, projectMilestoneId: 'ms-2' });
    const r = await bidService.list({ milestoneId: 'ms-1' });
    const list = Array.isArray(r) ? r : r.list;
    expect(list.length).toBe(1);
    expect(list[0].projectMilestoneId).toBe('ms-1');
  });

  it('delete 软删除', async () => {
    const b = await bidService.create({ bidNo: `${PREFIX}DEL` });
    await bidService.delete(b.id);
    const raw = await prisma.bidArchive.findUnique({ where: { id: b.id } });
    expect(raw.deletedAt).not.toBeNull();
  });

  it('changeStatus draft->submitted->archived', async () => {
    const b = await bidService.create({ bidNo: `${PREFIX}ST` });
    expect((await bidService.changeStatus(b.id, BID_STATUS.SUBMITTED)).status).toBe(BID_STATUS.SUBMITTED);
    expect((await bidService.changeStatus(b.id, BID_STATUS.ARCHIVED)).status).toBe(BID_STATUS.ARCHIVED);
  });
});

afterAll(async () => { await prisma.$disconnect(); });
