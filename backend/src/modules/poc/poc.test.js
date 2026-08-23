import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import pocService from './poc.service.js';
import { POC_STATUS } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';

async function cleanup() {
  await prisma.pocTracking.deleteMany({ where: { goal: { contains: PREFIX } } });
}

describe('POC Service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('create 成功写入默认 draft 且 customerParticipants 往返 JSON', async () => {
    const p = await pocService.create({ goal: `${PREFIX}客户A POC`, customerParticipants: ['甲', '乙'] });
    expect(p.id).toBeTruthy();
    expect(p.status).toBe(POC_STATUS.DRAFT);
    expect(p.customerParticipants).toEqual(['甲', '乙']);
    expect(p.deletedAt).toBeUndefined();
  });

  it('create goal 为空抛错', async () => {
    await expect(pocService.create({ goal: '' })).rejects.toThrow();
  });

  it('getById 不存在抛错', async () => {
    await expect(pocService.getById('not-exist')).rejects.toThrow('POC 不存在');
  });

  it('update 部分字段更新', async () => {
    const p = await pocService.create({ goal: `${PREFIX}更新` });
    const u = await pocService.update({ id: p.id, result: '验证通过', environment: '测试环境' });
    expect(u.result).toBe('验证通过');
    expect(u.environment).toBe('测试环境');
  });

  it('delete 软删除后 getById 不可见', async () => {
    const p = await pocService.create({ goal: `${PREFIX}删除` });
    await pocService.delete(p.id);
    const raw = await prisma.pocTracking.findUnique({ where: { id: p.id } });
    expect(raw.deletedAt).not.toBeNull();
    await expect(pocService.getById(p.id)).rejects.toThrow('POC 不存在');
  });

  it('changeStatus 合法链 draft->scheduled->in_progress->success', async () => {
    const p = await pocService.create({ goal: `${PREFIX}状态` });
    expect((await pocService.changeStatus(p.id, POC_STATUS.SCHEDULED)).status).toBe(POC_STATUS.SCHEDULED);
    expect((await pocService.changeStatus(p.id, POC_STATUS.IN_PROGRESS)).status).toBe(POC_STATUS.IN_PROGRESS);
    expect((await pocService.changeStatus(p.id, POC_STATUS.SUCCESS)).status).toBe(POC_STATUS.SUCCESS);
  });
});

afterAll(async () => { await prisma.$disconnect(); });
