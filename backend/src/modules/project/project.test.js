/**
 * Project 模块测试（阶段2）
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createProjectSchema, updateProjectSchema, listProjectSchema } from './project.schema.js';
import projectService from './project.service.js';
import { PROJECT_PHASE, PROJECT_PRIORITY, SECURITY_DOMAIN } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: 'file:D:\\荒天帝工作台\\data\\workbench.db', log: ['error'] });
const PREFIX = 'TEST_';

describe('Project Schema 校验', () => {
  it('合法数据应通过校验', () => {
    const data = createProjectSchema.parse({
      customerName: `${PREFIX}客户A`,
      phase: PROJECT_PHASE.REQUIREMENT,
      priority: PROJECT_PRIORITY.HIGH,
      securityDomains: [SECURITY_DOMAIN.DATA, SECURITY_DOMAIN.AI],
    });
    expect(data.customerName).toBe(`${PREFIX}客户A`);
    expect(data.phase).toBe('需求沟通');
    expect(data.securityDomains).toEqual(['数据安全', 'AI安全']);
  });
  it('客户名称为空应拒绝', () => {
    expect(createProjectSchema.safeParse({ customerName: '' }).success).toBe(false);
  });
  it('非法 phase 应拒绝', () => {
    expect(createProjectSchema.safeParse({ customerName: 'test', phase: '不存在' }).success).toBe(false);
  });
  it('默认值应正确', () => {
    const data = createProjectSchema.parse({ customerName: 'test' });
    expect(data.phase).toBe('需求沟通');
    expect(data.priority).toBe('中');
    expect(data.securityDomains).toEqual([]);
  });
});

describe('Project Service 集成测试', () => {
  beforeEach(async () => { await prisma.project.deleteMany({ where: { customerName: { startsWith: PREFIX } } }); });
  afterEach(async () => { await prisma.project.deleteMany({ where: { customerName: { startsWith: PREFIX } } }); });

  it('应成功创建项目', async () => {
    const created = await projectService.create({
      customerName: `${PREFIX}客户A`,
      phase: '需求沟通',
      priority: '高',
      securityDomains: ['数据安全', 'AI安全'],
    });
    expect(created.id).toBeTruthy();
    expect(created.customerName).toBe(`${PREFIX}客户A`);
    expect(created.securityDomains).toEqual(['数据安全', 'AI安全']);
    expect(created.progress).toBe(0);
  });

  it('应支持更新项目', async () => {
    const p = await projectService.create({ customerName: `${PREFIX}更新前` });
    const updated = await projectService.update({ id: p.id, customerName: `${PREFIX}更新后`, phase: '方案撰写' });
    expect(updated.customerName).toBe(`${PREFIX}更新后`);
    expect(updated.phase).toBe('方案撰写');
  });

  it('应支持列表查询', async () => {
    await projectService.create({ customerName: `${PREFIX}列表A`, phase: '需求沟通' });
    await projectService.create({ customerName: `${PREFIX}列表B`, phase: '项目结项' });
    const list = await projectService.list({});
    expect(list.some(p => p.customerName.startsWith(PREFIX))).toBe(true);
  });

  it('应支持按阶段筛选', async () => {
    await projectService.create({ customerName: `${PREFIX}筛选A`, phase: '需求沟通' });
    await projectService.create({ customerName: `${PREFIX}筛选B`, phase: '项目结项' });
    const list = await projectService.list({ phase: '需求沟通' });
    expect(list.some(p => p.customerName === `${PREFIX}筛选A`)).toBe(true);
    expect(list.some(p => p.customerName === `${PREFIX}筛选B`)).toBe(false);
  });

  it('应支持软删除（含关联级联）', async () => {
    const p = await projectService.create({ customerName: `${PREFIX}删除测试` });
    await projectService.delete(p.id);
    const raw = await prisma.project.findUnique({ where: { id: p.id } });
    expect(raw.deletedAt).not.toBeNull();
  });

  it('不存在的 ID 应抛出错误', async () => {
    await expect(projectService.getDetailById('non-existent')).rejects.toThrow('项目不存在');
  });

  it('应支持更新备忘', async () => {
    const p = await projectService.create({ customerName: `${PREFIX}备忘测试` });
    const updated = await projectService.updateMemo(p.id, '这是项目备忘内容');
    expect(updated.projectMemo).toBe('这是项目备忘内容');
  });
});

afterAll(async () => { await prisma.$disconnect(); });
