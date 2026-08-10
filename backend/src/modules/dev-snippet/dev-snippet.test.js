/**
 * DevSnippet 模块测试（阶段3）
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createDevSnippetSchema, updateDevSnippetSchema } from './dev-snippet.schema.js';
import devSnippetService from './dev-snippet.service.js';

const prisma = new PrismaClient({ datasourceUrl: 'file:D:\\荒天帝工作台\\data\\workbench.db', log: ['error'] });
const PREFIX = 'TEST_';

describe('DevSnippet Schema 校验', () => {
  it('合法数据应通过校验', () => {
    const data = createDevSnippetSchema.parse({ name: `${PREFIX}片段`, code: 'console.log("hello")' });
    expect(data.name).toBe(`${PREFIX}片段`);
    expect(data.category).toBe('其他');
  });
  it('名称为空应拒绝', () => {
    expect(createDevSnippetSchema.safeParse({ name: '', code: 'test' }).success).toBe(false);
  });
  it('代码为空应拒绝', () => {
    expect(createDevSnippetSchema.safeParse({ name: 'test', code: '' }).success).toBe(false);
  });
});

describe('DevSnippet Service 集成测试', () => {
  beforeEach(async () => { await prisma.devSnippet.deleteMany({ where: { name: { startsWith: PREFIX } } }); });
  afterEach(async () => { await prisma.devSnippet.deleteMany({ where: { name: { startsWith: PREFIX } } }); });

  it('应成功创建代码片段', async () => {
    const created = await devSnippetService.create({ name: `${PREFIX}创建`, code: 'const x = 1;', category: '工具函数' });
    expect(created.id).toBeTruthy();
    expect(created.code).toBe('const x = 1;');
    expect(created.category).toBe('工具函数');
  });

  it('应支持更新', async () => {
    const s = await devSnippetService.create({ name: `${PREFIX}更新前`, code: 'old' });
    const updated = await devSnippetService.update({ id: s.id, name: `${PREFIX}更新后`, code: 'new' });
    expect(updated.name).toBe(`${PREFIX}更新后`);
    expect(updated.code).toBe('new');
  });

  it('应支持按分类筛选', async () => {
    await devSnippetService.create({ name: `${PREFIX}筛选A`, code: 'x', category: 'Vue' });
    await devSnippetService.create({ name: `${PREFIX}筛选B`, code: 'x', category: 'Node' });
    const list = await devSnippetService.list({ category: 'Vue' });
    expect(list.some(s => s.name === `${PREFIX}筛选A`)).toBe(true);
    expect(list.some(s => s.name === `${PREFIX}筛选B`)).toBe(false);
  });

  it('应支持关键字搜索', async () => {
    await devSnippetService.create({ name: `${PREFIX}搜索_关键字`, code: 'x' });
    const list = await devSnippetService.list({ keyword: '关键字' });
    expect(list.some(s => s.name.startsWith(PREFIX))).toBe(true);
  });

  it('不存在的 ID 应抛出错误', async () => {
    await expect(devSnippetService.getById('non-existent')).rejects.toThrow('代码片段不存在');
  });

  it('应支持软删除', async () => {
    const s = await devSnippetService.create({ name: `${PREFIX}删除`, code: 'x' });
    await devSnippetService.delete(s.id);
    const raw = await prisma.devSnippet.findUnique({ where: { id: s.id } });
    expect(raw.deletedAt).not.toBeNull();
  });
});

afterAll(async () => { await prisma.$disconnect(); });
