/**
 * DevIssue 模块测试（阶段3）
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createDevIssueSchema, updateDevIssueSchema } from './dev-issue.schema.js';
import devIssueService from './dev-issue.service.js';
import { DEV_ISSUE_STATUS } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';

describe('DevIssue Schema 校验', () => {
  it('合法数据应通过校验', () => {
    const data = createDevIssueSchema.parse({ title: `${PREFIX}问题`, symptom: '报错XXX' });
    expect(data.title).toBe(`${PREFIX}问题`);
    expect(data.status).toBe(DEV_ISSUE_STATUS.PENDING);
  });
  it('标题为空应拒绝', () => {
    expect(createDevIssueSchema.safeParse({ title: '' }).success).toBe(false);
  });
  it('非法 status 应拒绝', () => {
    expect(createDevIssueSchema.safeParse({ title: 'test', status: '不存在' }).success).toBe(false);
  });
});

describe('DevIssue Service 集成测试', () => {
  beforeEach(async () => { await prisma.devIssue.deleteMany({ where: { title: { startsWith: PREFIX } } }); });
  afterEach(async () => { await prisma.devIssue.deleteMany({ where: { title: { startsWith: PREFIX } } }); });

  it('应成功创建开发问题', async () => {
    const created = await devIssueService.create({ title: `${PREFIX}创建`, symptom: '页面白屏', investigation: '检查console' });
    expect(created.id).toBeTruthy();
    expect(created.title).toBe(`${PREFIX}创建`);
    expect(created.status).toBe('待解决');
  });

  it('应支持更新状态', async () => {
    const i = await devIssueService.create({ title: `${PREFIX}更新` });
    const updated = await devIssueService.update({ id: i.id, status: '已解决', solution: '修复了XXX' });
    expect(updated.status).toBe('已解决');
    expect(updated.solution).toBe('修复了XXX');
  });

  it('应支持按状态筛选', async () => {
    await devIssueService.create({ title: `${PREFIX}筛选A`, status: '待解决' });
    await devIssueService.create({ title: `${PREFIX}筛选B`, status: '已解决' });
    const list = await devIssueService.list({ status: '待解决' });
    expect(list.some(i => i.title === `${PREFIX}筛选A`)).toBe(true);
    expect(list.some(i => i.title === `${PREFIX}筛选B`)).toBe(false);
  });

  it('应支持关键字搜索', async () => {
    await devIssueService.create({ title: `${PREFIX}搜索`, symptom: '包含关键字的问题' });
    const list = await devIssueService.list({ keyword: '关键字' });
    expect(list.some(i => i.title.startsWith(PREFIX))).toBe(true);
  });

  it('不存在的 ID 应抛出错误', async () => {
    await expect(devIssueService.getById('non-existent')).rejects.toThrow('开发问题不存在');
  });

  it('应支持软删除', async () => {
    const i = await devIssueService.create({ title: `${PREFIX}删除` });
    await devIssueService.delete(i.id);
    const raw = await prisma.devIssue.findUnique({ where: { id: i.id } });
    expect(raw.deletedAt).not.toBeNull();
  });
});

afterAll(async () => { await prisma.$disconnect(); });
