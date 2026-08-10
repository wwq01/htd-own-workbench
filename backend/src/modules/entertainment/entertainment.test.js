/**
 * Entertainment 模块测试（阶段4）
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createEntertainmentSchema, updateEntertainmentSchema } from './entertainment.schema.js';
import entertainmentService from './entertainment.service.js';
import { ENTERTAINMENT_TYPE, ENTERTAINMENT_STATUS } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: 'file:D:\\荒天帝工作台\\data\\workbench.db', log: ['error'] });
const PREFIX = 'TEST_';

describe('Entertainment Schema 校验', () => {
  it('合法数据应通过校验', () => {
    const data = createEntertainmentSchema.parse({ name: `${PREFIX}游戏`, rating: 5 });
    expect(data.name).toBe(`${PREFIX}游戏`);
    expect(data.type).toBe(ENTERTAINMENT_TYPE.GAME);
    expect(data.status).toBe(ENTERTAINMENT_STATUS.WANT);
  });
  it('名称为空应拒绝', () => {
    expect(createEntertainmentSchema.safeParse({ name: '' }).success).toBe(false);
  });
  it('非法 type 应拒绝', () => {
    expect(createEntertainmentSchema.safeParse({ name: 'test', type: '不存在' }).success).toBe(false);
  });
  it('rating 超范围应拒绝', () => {
    expect(createEntertainmentSchema.safeParse({ name: 'test', rating: 6 }).success).toBe(false);
    expect(createEntertainmentSchema.safeParse({ name: 'test', rating: -1 }).success).toBe(false);
  });
});

describe('Entertainment Service 集成测试', () => {
  beforeEach(async () => { await prisma.entertainment.deleteMany({ where: { name: { startsWith: PREFIX } } }); });
  afterEach(async () => { await prisma.entertainment.deleteMany({ where: { name: { startsWith: PREFIX } } }); });

  it('应成功创建娱乐内容', async () => {
    const created = await entertainmentService.create({ name: `${PREFIX}创建`, type: '游戏', status: '在玩', rating: 4 });
    expect(created.id).toBeTruthy();
    expect(created.name).toBe(`${PREFIX}创建`);
    expect(created.rating).toBe(4);
  });

  it('应支持更新', async () => {
    const e = await entertainmentService.create({ name: `${PREFIX}更新前` });
    const updated = await entertainmentService.update({ id: e.id, name: `${PREFIX}更新后`, rating: 5 });
    expect(updated.name).toBe(`${PREFIX}更新后`);
    expect(updated.rating).toBe(5);
  });

  it('应支持按类型筛选', async () => {
    await entertainmentService.create({ name: `${PREFIX}筛选A`, type: '游戏' });
    await entertainmentService.create({ name: `${PREFIX}筛选B`, type: '番剧' });
    const list = await entertainmentService.list({ type: '游戏' });
    expect(list.some(e => e.name === `${PREFIX}筛选A`)).toBe(true);
    expect(list.some(e => e.name === `${PREFIX}筛选B`)).toBe(false);
  });

  it('应支持关键字搜索', async () => {
    await entertainmentService.create({ name: `${PREFIX}搜索_关键字`, review: '好看' });
    const list = await entertainmentService.list({ keyword: '关键字' });
    expect(list.some(e => e.name.startsWith(PREFIX))).toBe(true);
  });

  it('应支持状态统计', async () => {
    await entertainmentService.create({ name: `${PREFIX}统计A`, status: '想看' });
    await entertainmentService.create({ name: `${PREFIX}统计B`, status: '在玩' });
    const stats = await entertainmentService.getStatusStats();
    expect(typeof stats).toBe('object');
  });

  it('不存在的 ID 应抛出错误', async () => {
    await expect(entertainmentService.getById('non-existent')).rejects.toThrow('娱乐内容不存在');
  });

  it('应支持软删除', async () => {
    const e = await entertainmentService.create({ name: `${PREFIX}删除` });
    await entertainmentService.delete(e.id);
    const raw = await prisma.entertainment.findUnique({ where: { id: e.id } });
    expect(raw.deletedAt).not.toBeNull();
  });
});

afterAll(async () => { await prisma.$disconnect(); });
