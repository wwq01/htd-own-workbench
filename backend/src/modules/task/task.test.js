/**
 * Task 模块测试（阶段2）
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createTaskSchema, updateTaskSchema } from './task.schema.js';
import taskService from './task.service.js';
import projectService from '../project/project.service.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';
let testProjectId;

describe('Task Schema 校验', () => {
  it('合法数据应通过校验', () => {
    const data = createTaskSchema.parse({ projectId: 'test-id', name: `${PREFIX}任务` });
    expect(data.name).toBe(`${PREFIX}任务`);
    expect(data.completed).toBe(false);
    expect(data.sortOrder).toBe(0);
  });
  it('名称为空应拒绝', () => {
    expect(createTaskSchema.safeParse({ projectId: 'x', name: '' }).success).toBe(false);
  });
  it('项目 ID 为空应拒绝', () => {
    expect(createTaskSchema.safeParse({ projectId: '', name: 'test' }).success).toBe(false);
  });
  it('默认值应正确', () => {
    const data = createTaskSchema.parse({ projectId: 'p1', name: 'task' });
    expect(data.completed).toBe(false);
    expect(data.sortOrder).toBe(0);
  });
});

describe('Task Service 集成测试', () => {
  beforeEach(async () => {
    await prisma.projectTask.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.project.deleteMany({ where: { customerName: { startsWith: PREFIX } } });
    const p = await projectService.create({ customerName: `${PREFIX}任务测试项目` });
    testProjectId = p.id;
  });
  afterEach(async () => {
    await prisma.projectTask.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.project.deleteMany({ where: { customerName: { startsWith: PREFIX } } });
  });

  it('应成功创建任务', async () => {
    const t = await taskService.create({ projectId: testProjectId, name: `${PREFIX}任务1` });
    expect(t.id).toBeTruthy();
    expect(t.name).toBe(`${PREFIX}任务1`);
    expect(t.completed).toBe(false);
  });

  it('关联项目不存在应拒绝', async () => {
    await expect(
      taskService.create({ projectId: 'non-existent', name: `${PREFIX}test` })
    ).rejects.toThrow('关联项目不存在');
  });

  it('应支持更新任务', async () => {
    const t = await taskService.create({ projectId: testProjectId, name: `${PREFIX}更新前` });
    const updated = await taskService.update({ id: t.id, name: `${PREFIX}更新后` });
    expect(updated.name).toBe(`${PREFIX}更新后`);
  });

  it('应支持切换完成状态', async () => {
    const t = await taskService.create({ projectId: testProjectId, name: `${PREFIX}切换` });
    const done = await taskService.toggleStatus(t.id);
    expect(done.completed).toBe(true);
    const undone = await taskService.toggleStatus(t.id);
    expect(undone.completed).toBe(false);
  });

  it('应支持按项目查询列表', async () => {
    await taskService.create({ projectId: testProjectId, name: `${PREFIX}列表1` });
    await taskService.create({ projectId: testProjectId, name: `${PREFIX}列表2` });
    const list = await taskService.list({ projectId: testProjectId });
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it('列表查询缺少 projectId 应拒绝', async () => {
    await expect(taskService.list({})).rejects.toThrow('projectId 不能为空');
  });

  it('应支持软删除', async () => {
    const t = await taskService.create({ projectId: testProjectId, name: `${PREFIX}删除` });
    await taskService.delete(t.id);
    const raw = await prisma.projectTask.findUnique({ where: { id: t.id } });
    expect(raw.deletedAt).not.toBeNull();
  });

  it('不存在的 ID 应抛出错误', async () => {
    await expect(taskService.toggleStatus('non-existent')).rejects.toThrow('任务不存在');
    await expect(taskService.delete('non-existent')).rejects.toThrow('任务不存在');
  });
});

afterAll(async () => { await prisma.$disconnect(); });
