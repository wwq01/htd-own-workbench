/**
 * DevProject 模块测试（阶段3）
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createDevProjectSchema, updateDevProjectSchema } from './dev-project.schema.js';
import devProjectService from './dev-project.service.js';
import { DEV_PROJECT_STATUS } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';

describe('DevProject Schema 校验', () => {
  it('合法数据应通过校验', () => {
    const data = createDevProjectSchema.parse({ name: `${PREFIX}开发项目`, techStack: ['Vue3', 'Node.js'], todoItems: ['搭建框架'] });
    expect(data.name).toBe(`${PREFIX}开发项目`);
    expect(data.techStack).toEqual(['Vue3', 'Node.js']);
    expect(data.status).toBe(DEV_PROJECT_STATUS.DEVELOPING);
  });
  it('名称为空应拒绝', () => {
    expect(createDevProjectSchema.safeParse({ name: '' }).success).toBe(false);
  });
  it('非法 status 应拒绝', () => {
    expect(createDevProjectSchema.safeParse({ name: 'test', status: '不存在' }).success).toBe(false);
  });
});

describe('DevProject Service 集成测试', () => {
  beforeEach(async () => { await prisma.devProject.deleteMany({ where: { name: { startsWith: PREFIX } } }); });
  afterEach(async () => { await prisma.devProject.deleteMany({ where: { name: { startsWith: PREFIX } } }); });

  it('应成功创建并返回数组字段', async () => {
    const created = await devProjectService.create({
      name: `${PREFIX}创建`,
      techStack: ['Vue3', 'Express'],
      todoItems: ['任务1', '任务2'],
    });
    expect(created.id).toBeTruthy();
    expect(created.techStack).toEqual(['Vue3', 'Express']);
    expect(created.todoItems).toEqual(['任务1', '任务2']);
  });

  it('应支持更新', async () => {
    const p = await devProjectService.create({ name: `${PREFIX}更新前` });
    const updated = await devProjectService.update({ id: p.id, name: `${PREFIX}更新后`, status: '已完成' });
    expect(updated.name).toBe(`${PREFIX}更新后`);
    expect(updated.status).toBe('已完成');
  });

  it('应支持按状态筛选', async () => {
    await devProjectService.create({ name: `${PREFIX}筛选A`, status: '开发中' });
    await devProjectService.create({ name: `${PREFIX}筛选B`, status: '已完成' });
    const list = await devProjectService.list({ status: '开发中' });
    expect(list.some(p => p.name === `${PREFIX}筛选A`)).toBe(true);
    expect(list.some(p => p.name === `${PREFIX}筛选B`)).toBe(false);
  });

  it('不存在的 ID 应抛出错误', async () => {
    await expect(devProjectService.getById('non-existent')).rejects.toThrow('开发项目不存在');
  });

  it('应支持软删除', async () => {
    const p = await devProjectService.create({ name: `${PREFIX}删除` });
    await devProjectService.delete(p.id);
    const raw = await prisma.devProject.findUnique({ where: { id: p.id } });
    expect(raw.deletedAt).not.toBeNull();
  });
});

afterAll(async () => { await prisma.$disconnect(); });
