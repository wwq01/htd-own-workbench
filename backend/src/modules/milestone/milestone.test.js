/**
 * Milestone 模块测试（阶段2）
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createMilestoneSchema, updateMilestoneSchema } from './milestone.schema.js';
import milestoneService from './milestone.service.js';
import projectService from '../project/project.service.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';
let testProjectId;

describe('Milestone Schema 校验', () => {
  it('合法数据应通过校验', () => {
    const data = createMilestoneSchema.parse({ projectId: 'test-id', name: `${PREFIX}里程碑`, dueDate: '2026-12-31' });
    expect(data.name).toBe(`${PREFIX}里程碑`);
    expect(data.completed).toBe(false);
  });
  it('名称为空应拒绝', () => {
    expect(createMilestoneSchema.safeParse({ projectId: 'x', name: '', dueDate: '2026-12-31' }).success).toBe(false);
  });
  it('非法日期格式应拒绝', () => {
    expect(createMilestoneSchema.safeParse({ projectId: 'x', name: 'test', dueDate: '2026/12/31' }).success).toBe(false);
  });
});

describe('Milestone Service 集成测试', () => {
  beforeEach(async () => {
    await prisma.projectMilestone.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.project.deleteMany({ where: { customerName: { startsWith: PREFIX } } });
    const p = await projectService.create({ customerName: `${PREFIX}里程碑测试项目` });
    testProjectId = p.id;
  });
  afterEach(async () => {
    await prisma.projectMilestone.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.project.deleteMany({ where: { customerName: { startsWith: PREFIX } } });
  });

  it('应成功创建里程碑', async () => {
    const m = await milestoneService.create({ projectId: testProjectId, name: `${PREFIX}里程碑1`, dueDate: '2026-12-31' });
    expect(m.id).toBeTruthy();
    expect(m.name).toBe(`${PREFIX}里程碑1`);
    expect(m.completed).toBe(false);
  });

  it('关联项目不存在应拒绝', async () => {
    await expect(
      milestoneService.create({ projectId: 'non-existent', name: `${PREFIX}test`, dueDate: '2026-12-31' })
    ).rejects.toThrow('关联项目不存在');
  });

  it('应支持切换完成状态', async () => {
    const m = await milestoneService.create({ projectId: testProjectId, name: `${PREFIX}切换`, dueDate: '2026-12-31' });
    const done = await milestoneService.toggleStatus(m.id);
    expect(done.completed).toBe(true);
    const undone = await milestoneService.toggleStatus(m.id);
    expect(undone.completed).toBe(false);
  });

  it('应支持按项目查询列表', async () => {
    await milestoneService.create({ projectId: testProjectId, name: `${PREFIX}列表1`, dueDate: '2026-12-31' });
    await milestoneService.create({ projectId: testProjectId, name: `${PREFIX}列表2`, dueDate: '2026-12-31' });
    const list = await milestoneService.list({ projectId: testProjectId });
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it('应支持软删除', async () => {
    const m = await milestoneService.create({ projectId: testProjectId, name: `${PREFIX}删除`, dueDate: '2026-12-31' });
    await milestoneService.delete(m.id);
    const raw = await prisma.projectMilestone.findUnique({ where: { id: m.id } });
    expect(raw.deletedAt).not.toBeNull();
  });
});

afterAll(async () => { await prisma.$disconnect(); });
