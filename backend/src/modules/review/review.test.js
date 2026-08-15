/**
 * Review 模块测试（阶段4）
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createReviewSchema, updateReviewSchema } from './review.schema.js';
import reviewService from './review.service.js';
import { REVIEW_TYPE } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';

describe('Review Schema 校验', () => {
  it('合法周复盘数据应通过校验', () => {
    const data = createReviewSchema.parse({
      type: REVIEW_TYPE.WEEK,
      weekKey: '2026-W32',
      highlights: '完成了阶段4',
    });
    expect(data.type).toBe('week');
    expect(data.weekKey).toBe('2026-W32');
  });
  it('非法 weekKey 格式应拒绝', () => {
    expect(createReviewSchema.safeParse({ type: 'week', weekKey: '2026-W32-1' }).success).toBe(false);
  });
  it('非法 type 应拒绝', () => {
    expect(createReviewSchema.safeParse({ type: '不存在' }).success).toBe(false);
  });
});

describe('Review Service 集成测试', () => {
  beforeEach(async () => { await prisma.review.deleteMany({ where: { remark: { contains: PREFIX } } }); });
  afterEach(async () => { await prisma.review.deleteMany({ where: { remark: { contains: PREFIX } } }); });

  it('应成功创建周复盘', async () => {
    const created = await reviewService.create({
      type: 'week',
      weekKey: '2026-W99',
      highlights: `${PREFIX}周复盘亮点`,
      pitfalls: `${PREFIX}踩坑`,
      remark: `${PREFIX}测试-周复盘`,
    });
    expect(created.id).toBeTruthy();
    expect(created.type).toBe('week');
    expect(created.weekKey).toBe('2026-W99');
    expect(created.highlights).toBe(`${PREFIX}周复盘亮点`);
  });

  it('应成功创建项目复盘', async () => {
    const created = await reviewService.create({
      type: 'project',
      customerPainPoints: `${PREFIX}客户痛点`,
      reviewResult: '成单',
      remark: `${PREFIX}测试-项目复盘`,
    });
    expect(created.id).toBeTruthy();
    expect(created.type).toBe('project');
    expect(created.customerPainPoints).toBe(`${PREFIX}客户痛点`);
  });

  it('应支持更新', async () => {
    const r = await reviewService.create({ type: 'week', weekKey: '2026-W98', remark: `${PREFIX}更新前` });
    const updated = await reviewService.update({ id: r.id, highlights: `${PREFIX}更新后亮点` });
    expect(updated.highlights).toBe(`${PREFIX}更新后亮点`);
  });

  it('应支持按类型筛选', async () => {
    await reviewService.create({ type: 'week', weekKey: '2026-W97', remark: `${PREFIX}筛选A` });
    await reviewService.create({ type: 'project', remark: `${PREFIX}筛选B` });
    const weekList = await reviewService.list({ type: 'week' });
    expect(weekList.some(r => r.remark === `${PREFIX}筛选A`)).toBe(true);
    expect(weekList.some(r => r.remark === `${PREFIX}筛选B`)).toBe(false);
  });

  it('应支持一键生成本周复盘', async () => {
    // 先清理可能已存在的本周复盘
    const result = await reviewService.createCurrentWeek();
    expect(result.review).toBeDefined();
    expect(result.review.type).toBe('week');
    expect(result.review.weekKey).toBeTruthy();
    // 第二次调用应返回 created: false
    const result2 = await reviewService.createCurrentWeek();
    expect(result2.created).toBe(false);
    // 清理自动生成的复盘
    if (result.created) {
      await prisma.review.delete({ where: { id: result.review.id } });
    }
  });

  it('不存在的 ID 应抛出错误', async () => {
    await expect(reviewService.getById('non-existent')).rejects.toThrow('复盘不存在');
  });

  it('应支持软删除', async () => {
    const r = await reviewService.create({ type: 'week', weekKey: '2026-W96', remark: `${PREFIX}删除` });
    await reviewService.delete(r.id);
    const raw = await prisma.review.findUnique({ where: { id: r.id } });
    expect(raw.deletedAt).not.toBeNull();
  });
});

afterAll(async () => { await prisma.$disconnect(); });
