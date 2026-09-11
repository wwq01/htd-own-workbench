import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import readingService from './reading.service.js';
import { READING_TYPE, READING_STATUS } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';

async function cleanup() {
  await prisma.readingMaterial.deleteMany({ where: { title: { contains: PREFIX } } });
  await prisma.vaultItem.deleteMany({ where: { sourceType: 'READING_NOTE' } });
}

describe('Reading Service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('create 必填 title；默认 type=文章/readingStatus=unread', async () => {
    const r = await readingService.create({ title: `${PREFIX}标题A` });
    expect(r.id).toBeTruthy();
    expect(r.type).toBe(READING_TYPE.ARTICLE);
    expect(r.readingStatus).toBe(READING_STATUS.UNREAD);
    expect(r.deletedAt).toBeUndefined();
  });

  it('create 缺 title 抛错', async () => {
    await expect(readingService.create({})).rejects.toThrow();
  });

  it('create 自定义字段 customFields 存为对象返回', async () => {
    const r = await readingService.create({
      title: `${PREFIX}自定义`,
      customFields: { author: '张三', score: '9' },
    });
    expect(r.customFields).toEqual({ author: '张三', score: '9' });
  });

  it('list 按 readingStatus 过滤', async () => {
    await readingService.create({ title: `${PREFIX}A`, readingStatus: READING_STATUS.UNREAD });
    await readingService.create({ title: `${PREFIX}B`, readingStatus: READING_STATUS.READING });
    const list = await readingService.list({ readingStatus: READING_STATUS.READING });
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(1);
    expect(list[0].readingStatus).toBe(READING_STATUS.READING);
  });

  it('list ?fields 裁剪仅返回指定字段', async () => {
    await readingService.create({ title: `${PREFIX}裁剪`, notes: '长笔记', type: READING_TYPE.CVE });
    const list = await readingService.list({ fields: 'id,title' });
    expect(list[0].id).toBeTruthy();
    expect(list[0].title).toBe(`${PREFIX}裁剪`);
    expect(list[0].notes).toBeUndefined();
    expect(list[0].type).toBeUndefined();
  });

  it('update 改 notes 与 type', async () => {
    const r = await readingService.create({ title: `${PREFIX}U` });
    const u = await readingService.update({ id: r.id, notes: '笔记内容', type: READING_TYPE.PAPER });
    expect(u.notes).toBe('笔记内容');
    expect(u.type).toBe(READING_TYPE.PAPER);
  });

  it('delete 软删除', async () => {
    const r = await readingService.create({ title: `${PREFIX}D` });
    await readingService.delete(r.id);
    const raw = await prisma.readingMaterial.findUnique({ where: { id: r.id } });
    expect(raw.deletedAt).not.toBeNull();
  });

  it('changeStatus unread->reading->precipitated->archived', async () => {
    const r = await readingService.create({ title: `${PREFIX}ST` });
    expect((await readingService.changeStatus(r.id, READING_STATUS.READING)).readingStatus).toBe(READING_STATUS.READING);
    expect((await readingService.changeStatus(r.id, READING_STATUS.PRECIPITATED)).readingStatus).toBe(READING_STATUS.PRECIPITATED);
    expect((await readingService.changeStatus(r.id, READING_STATUS.ARCHIVED)).readingStatus).toBe(READING_STATUS.ARCHIVED);
  });

  it('convertToVault 一键沉淀且幂等', async () => {
    const r = await readingService.create({ title: `${PREFIX}沉淀`, notes: '要点', tags: ['安全'] });
    const v1 = await readingService.convertToVault(r.id);
    expect(v1.id).toBeTruthy();
    expect(v1.sourceId).toBe(r.id);
    const v2 = await readingService.convertToVault(r.id);
    expect(v2.id).toBe(v1.id); // 幂等，不重复创建
  });
});

afterAll(async () => { await prisma.$disconnect(); });
