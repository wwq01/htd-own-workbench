/**
 * Memo 模块测试（阶段1）
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createMemoSchema, updateMemoSchema } from './memo.schema.js';
import memoService from './memo.service.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';

describe('Memo Schema 校验', () => {
  it('合法数据应通过', () => {
    const data = createMemoSchema.parse({ content: `${PREFIX}测试备忘` });
    expect(data.content).toBe(`${PREFIX}测试备忘`);
  });
  it('内容为空应拒绝', () => {
    expect(createMemoSchema.safeParse({ content: '' }).success).toBe(false);
  });
  it('内容超长应拒绝', () => {
    expect(createMemoSchema.safeParse({ content: 'x'.repeat(1001) }).success).toBe(false);
  });
  it('update 缺少 id 应拒绝', () => {
    expect(updateMemoSchema.safeParse({ content: 'test' }).success).toBe(false);
  });
});

describe('Memo Service 集成测试', () => {
  beforeEach(async () => { await prisma.memo.deleteMany({ where: { content: { startsWith: PREFIX } } }); });
  afterEach(async () => { await prisma.memo.deleteMany({ where: { content: { startsWith: PREFIX } } }); });

  it('应成功创建备忘', async () => {
    const created = await memoService.create({ content: `${PREFIX}创建备忘` });
    expect(created.id).toBeTruthy();
    expect(created.content).toBe(`${PREFIX}创建备忘`);
  });

  it('应支持更新备忘', async () => {
    const m = await memoService.create({ content: `${PREFIX}更新前` });
    const updated = await memoService.update({ id: m.id, content: `${PREFIX}更新后` });
    expect(updated.content).toBe(`${PREFIX}更新后`);
  });

  it('不存在的 ID 应抛出错误', async () => {
    await expect(memoService.getById('non-existent')).rejects.toThrow('备忘不存在');
  });

  it('应支持软删除', async () => {
    const m = await memoService.create({ content: `${PREFIX}删除` });
    await memoService.delete(m.id);
    const raw = await prisma.memo.findUnique({ where: { id: m.id } });
    expect(raw.deletedAt).not.toBeNull();
  });

  it('应支持列表查询', async () => {
    await memoService.create({ content: `${PREFIX}列表1` });
    await memoService.create({ content: `${PREFIX}列表2` });
    const list = await memoService.list({});
    expect(list.some(m => m.content.startsWith(PREFIX))).toBe(true);
  });
});

afterAll(async () => { await prisma.$disconnect(); });
