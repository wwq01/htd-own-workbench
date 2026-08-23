import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import incidentService from './incident.service.js';
import { EMERGENCY_STATUS, SEVERITY } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';

async function cleanup() {
  await prisma.emergencyResponse.deleteMany({ where: { title: { contains: PREFIX } } });
}

describe('Incident Service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('create 必填 title；时间线/动作数组往返', async () => {
    const inc = await incidentService.create({
      title: `${PREFIX}入侵事件`,
      eventTimeline: [{ time: '10:00', event: '发现异常' }],
      responseActions: [{ action: '隔离主机', owner: '甲' }],
    });
    expect(inc.id).toBeTruthy();
    expect(inc.status).toBe(EMERGENCY_STATUS.OPEN);
    expect(inc.eventTimeline).toHaveLength(1);
    expect(inc.eventTimeline[0].event).toBe('发现异常');
    expect(inc.responseActions).toHaveLength(1);
    expect(inc.deletedAt).toBeUndefined();
  });

  it('create title 为空抛错', async () => {
    await expect(incidentService.create({ title: '' })).rejects.toThrow();
  });

  it('getById 不存在抛错', async () => {
    await expect(incidentService.getById('nope')).rejects.toThrow('应急记录不存在');
  });

  it('addTimeline 追加并合并写回', async () => {
    const inc = await incidentService.create({ title: `${PREFIX}追加` });
    const u = await incidentService.addTimeline(inc.id, { time: '11:00', event: '处置' });
    expect(u.eventTimeline).toHaveLength(1);
    expect(u.eventTimeline[0].event).toBe('处置');
  });

  it('addTimeline 非法条目(缺 time)抛错', async () => {
    const inc = await incidentService.create({ title: `${PREFIX}非法` });
    await expect(incidentService.addTimeline(inc.id, { event: 'x' })).rejects.toThrow();
  });

  it('addActions 追加处置动作', async () => {
    const inc = await incidentService.create({ title: `${PREFIX}动作` });
    const u = await incidentService.addActions(inc.id, { action: '溯源', result: '完成' });
    expect(u.responseActions).toHaveLength(1);
    expect(u.responseActions[0].action).toBe('溯源');
  });

  it('delete 软删除', async () => {
    const inc = await incidentService.create({ title: `${PREFIX}删除` });
    await incidentService.delete(inc.id);
    const raw = await prisma.emergencyResponse.findUnique({ where: { id: inc.id } });
    expect(raw.deletedAt).not.toBeNull();
  });

  it('changeStatus open->contained->resolved->closed', async () => {
    const inc = await incidentService.create({ title: `${PREFIX}状态` });
    expect((await incidentService.changeStatus(inc.id, EMERGENCY_STATUS.CONTAINED)).status).toBe(EMERGENCY_STATUS.CONTAINED);
    expect((await incidentService.changeStatus(inc.id, EMERGENCY_STATUS.RESOLVED)).status).toBe(EMERGENCY_STATUS.RESOLVED);
    expect((await incidentService.changeStatus(inc.id, EMERGENCY_STATUS.CLOSED)).status).toBe(EMERGENCY_STATUS.CLOSED);
  });
});

afterAll(async () => { await prisma.$disconnect(); });
