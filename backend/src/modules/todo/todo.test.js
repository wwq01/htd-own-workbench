/**
 * Todo 模块测试（阶段1）
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createTodoSchema, updateTodoSchema, listTodoSchema } from './todo.schema.js';
import todoService from './todo.service.js';
import { TODO_STATUS, TODO_PRIORITY, TODO_CATEGORY } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';
const TODAY = '2026-08-10';

describe('Todo Schema 校验', () => {
  it('合法数据应通过校验', () => {
    const data = createTodoSchema.parse({ title: `${PREFIX}测试`, todoDate: TODAY });
    expect(data.title).toBe(`${PREFIX}测试`);
    expect(data.category).toBe(TODO_CATEGORY.DAILY);
    expect(data.priority).toBe(TODO_PRIORITY.MEDIUM);
  });
  it('标题为空应拒绝', () => {
    expect(createTodoSchema.safeParse({ title: '', todoDate: TODAY }).success).toBe(false);
  });
  it('非法日期格式应拒绝', () => {
    expect(createTodoSchema.safeParse({ title: 'test', todoDate: '2026/08/10' }).success).toBe(false);
  });
  it('非法 category 应拒绝', () => {
    expect(createTodoSchema.safeParse({ title: 'test', todoDate: TODAY, category: '不存在' }).success).toBe(false);
  });
  it('update 缺少 id 应拒绝', () => {
    expect(updateTodoSchema.safeParse({ title: 'test' }).success).toBe(false);
  });
});

describe('Todo Service 集成测试', () => {
  beforeEach(async () => { await prisma.todo.deleteMany({ where: { title: { startsWith: PREFIX } } }); });
  afterEach(async () => { await prisma.todo.deleteMany({ where: { title: { startsWith: PREFIX } } }); });

  it('应成功创建待办', async () => {
    const created = await todoService.create({ title: `${PREFIX}创建`, todoDate: TODAY, priority: '高' });
    expect(created.id).toBeTruthy();
    expect(created.title).toBe(`${PREFIX}创建`);
    expect(created.status).toBe('pending');
  });

  it('应支持列表查询按日期', async () => {
    await todoService.create({ title: `${PREFIX}列表`, todoDate: TODAY });
    const list = await todoService.list({ todoDate: TODAY });
    expect(list.some(t => t.title.startsWith(PREFIX))).toBe(true);
  });

  it('应支持切换完成状态', async () => {
    const t = await todoService.create({ title: `${PREFIX}切换`, todoDate: TODAY });
    const done = await todoService.toggleStatus(t.id);
    expect(done.status).toBe('completed');
    expect(done.completedAt).not.toBeNull();
    const undone = await todoService.toggleStatus(t.id);
    expect(undone.status).toBe('pending');
    expect(undone.completedAt).toBeNull();
  });

  it('应支持更新待办', async () => {
    const t = await todoService.create({ title: `${PREFIX}更新`, todoDate: TODAY });
    const updated = await todoService.update({ id: t.id, title: `${PREFIX}更新后`, status: 'completed' });
    expect(updated.title).toBe(`${PREFIX}更新后`);
    expect(updated.status).toBe('completed');
    expect(updated.completedAt).not.toBeNull();
  });

  it('不存在的 ID 应抛出错误', async () => {
    await expect(todoService.getById('non-existent')).rejects.toThrow('待办不存在');
    await expect(todoService.delete('non-existent')).rejects.toThrow('待办不存在');
  });

  it('应支持软删除', async () => {
    const t = await todoService.create({ title: `${PREFIX}删除`, todoDate: TODAY });
    await todoService.delete(t.id);
    const raw = await prisma.todo.findUnique({ where: { id: t.id } });
    expect(raw.deletedAt).not.toBeNull();
  });

  it('应支持日期统计', async () => {
    await todoService.create({ title: `${PREFIX}统计1`, todoDate: TODAY });
    await todoService.create({ title: `${PREFIX}统计2`, todoDate: TODAY, status: 'completed' });
    const stats = await todoService.getStatsForDate(TODAY);
    expect(stats.total).toBeGreaterThanOrEqual(2);
  });
});

afterAll(async () => { await prisma.$disconnect(); });
