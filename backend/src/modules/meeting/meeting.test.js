import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import meetingService from './meeting.service.js';
import { VAULT_SOURCE_TYPE } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';

async function cleanup() {
  await prisma.review.deleteMany({ where: { remark: { contains: PREFIX } } });
  await prisma.meeting.deleteMany({ where: { title: { contains: PREFIX } } });
}

describe('Meeting Service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('create 成功写入并序列化 JSON 字段', async () => {
    const m = await meetingService.create({
      title: `${PREFIX}评审会`, heldAt: '2026-08-10T10:00:00.000Z',
      participants: ['张三'], agenda: [{ title: '议题A' }],
    });
    expect(m.id).toBeTruthy();
    expect(m.participants).toBe('["张三"]');
    expect(m.agenda).toBe('[{"title":"议题A"}]');
  });

  it('create 缺标题被 zod 拒绝', async () => {
    await expect(meetingService.create({ heldAt: '2026-08-10T10:00:00.000Z' }))
      .rejects.toThrow();
  });

  it('getById 不存在抛错', async () => {
    await expect(meetingService.getById('nope')).rejects.toThrow('会议不存在');
  });

  it('list 按 keyword 匹配标题', async () => {
    await meetingService.create({ title: `${PREFIX}项目启动会`, heldAt: '2026-08-01T09:00:00.000Z' });
    await meetingService.create({ title: `${PREFIX}周例会`, heldAt: '2026-08-02T09:00:00.000Z' });
    const list = await meetingService.list({ keyword: '启动' });
    expect(list.length).toBe(1);
    expect(list[0].title).toContain('启动会');
  });

  it('update 部分更新（含 id 对象）', async () => {
    const m = await meetingService.create({ title: `${PREFIX}原`, heldAt: '2026-08-01T09:00:00.000Z' });
    const upd = await meetingService.update({ id: m.id, title: `${PREFIX}改` });
    expect(upd.title).toContain('改');
  });

  it('generateReview 跨模块生成 draft 复盘并回写 reviewId', async () => {
    const m = await meetingService.create({
      title: `${PREFIX}评审会`, heldAt: '2026-08-10T10:00:00.000Z',
      decisions: [{ content: '采用方案A', owner: '张三' }],
      actionItems: [{ content: '写文档', owner: '李四', done: false }],
    });
    const review = await meetingService.generateReview(m.id);
    expect(review.status).toBe('draft');
    expect(review.vaultSourceType).toBe(VAULT_SOURCE_TYPE.MEETING_REVIEW);
    expect(review.remark).toContain('评审会');
    const refreshed = await meetingService.getById(m.id);
    expect(refreshed.reviewId).toBe(review.id);
  });

  it('delete 软删除', async () => {
    const m = await meetingService.create({ title: `${PREFIX}删`, heldAt: '2026-08-01T09:00:00.000Z' });
    await meetingService.delete(m.id);
    const raw = await prisma.meeting.findUnique({ where: { id: m.id } });
    expect(raw.deletedAt).not.toBeNull();
  });
});

afterAll(async () => { await prisma.$disconnect(); });
