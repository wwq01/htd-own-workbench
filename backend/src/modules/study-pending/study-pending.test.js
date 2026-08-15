/**
 * StudyPending 模块测试（阶段3）
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createStudyPendingSchema, completeStudyPendingSchema } from './study-pending.schema.js';
import studyPendingService from './study-pending.service.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';
const TODAY = '2026-08-10';

describe('StudyPending Schema 校验', () => {
  it('合法数据应通过校验', () => {
    const data = createStudyPendingSchema.parse({ title: `${PREFIX}待学资源`, resourceType: '文章' });
    expect(data.title).toBe(`${PREFIX}待学资源`);
    expect(data.completed).toBeUndefined(); // create schema 不含 completed
  });
  it('标题为空应拒绝', () => {
    expect(createStudyPendingSchema.safeParse({ title: '' }).success).toBe(false);
  });
  it('completeStudyPendingSchema 缺少 id 应拒绝', () => {
    expect(completeStudyPendingSchema.safeParse({ studyDate: TODAY }).success).toBe(false);
  });
  it('completeStudyPendingSchema 非法日期应拒绝', () => {
    expect(completeStudyPendingSchema.safeParse({ id: 'x', studyDate: '2026/08/10' }).success).toBe(false);
  });
});

describe('StudyPending Service 集成测试', () => {
  beforeEach(async () => {
    await prisma.studyRecord.deleteMany({ where: { topic: { startsWith: PREFIX } } });
    await prisma.studyPending.deleteMany({ where: { title: { startsWith: PREFIX } } });
  });
  afterEach(async () => {
    await prisma.studyRecord.deleteMany({ where: { topic: { startsWith: PREFIX } } });
    await prisma.studyPending.deleteMany({ where: { title: { startsWith: PREFIX } } });
  });

  it('应成功创建待学清单', async () => {
    const created = await studyPendingService.create({ title: `${PREFIX}创建`, resourceType: '视频' });
    expect(created.id).toBeTruthy();
    expect(created.title).toBe(`${PREFIX}创建`);
    expect(created.completed).toBe(false);
  });

  it('应支持更新', async () => {
    const p = await studyPendingService.create({ title: `${PREFIX}更新前` });
    const updated = await studyPendingService.update({ id: p.id, title: `${PREFIX}更新后` });
    expect(updated.title).toBe(`${PREFIX}更新后`);
  });

  it('应支持按完成状态筛选', async () => {
    const p1 = await studyPendingService.create({ title: `${PREFIX}筛选A` });
    await studyPendingService.create({ title: `${PREFIX}筛选B` });
    await studyPendingService.update({ id: p1.id, completed: true }).catch(() => {});
    // 直接更新 completed 字段
    await prisma.studyPending.update({ where: { id: p1.id }, data: { completed: true } });
    const list = await studyPendingService.list({ completed: false });
    expect(list.some(p => p.title === `${PREFIX}筛选B`)).toBe(true);
    expect(list.some(p => p.title === `${PREFIX}筛选A`)).toBe(false);
  });

  it('应支持标记已学习并转为学习记录', async () => {
    const p = await studyPendingService.create({
      title: `${PREFIX}转学习记录`,
      resourceType: '文章',
      sourceLink: 'https://example.com',
    });
    const result = await studyPendingService.completeAndConvert({
      id: p.id,
      studyDate: TODAY,
      duration: 2,
      notes: '学到了很多',
    });
    expect(result.pending.completed).toBe(true);
    expect(result.record.topic).toBe(`${PREFIX}转学习记录`);
    expect(result.record.duration).toBe(2);
    expect(result.record.studyDate).toBe(TODAY);
  });

  it('重复标记已学习应抛出错误', async () => {
    const p = await studyPendingService.create({ title: `${PREFIX}重复标记` });
    await studyPendingService.completeAndConvert({ id: p.id, studyDate: TODAY, duration: 1 });
    await expect(
      studyPendingService.completeAndConvert({ id: p.id, studyDate: TODAY, duration: 1 })
    ).rejects.toThrow('已标记为已学习');
  });

  it('不存在的 ID 应抛出错误', async () => {
    await expect(studyPendingService.getById('non-existent')).rejects.toThrow('待学清单不存在');
  });

  it('应支持软删除', async () => {
    const p = await studyPendingService.create({ title: `${PREFIX}删除` });
    await studyPendingService.delete(p.id);
    const raw = await prisma.studyPending.findUnique({ where: { id: p.id } });
    expect(raw.deletedAt).not.toBeNull();
  });
});

afterAll(async () => { await prisma.$disconnect(); });
