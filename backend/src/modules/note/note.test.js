import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import noteService from './note.service.js';
import { NOTE_SOURCE_TYPE } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
// 以固定来源 ID 隔离测试数据，避免污染业务笔记
const SID = 'TEST_READING_001';

async function clean() {
  await prisma.note.deleteMany({ where: { sourceId: { in: [SID, 'TEST_READING_002'] } } });
}

describe('Note Service（S2-4 双轨笔记）', () => {
  beforeEach(clean);
  afterEach(clean);
  afterAll(async () => { await prisma.$disconnect(); });

  it('create 默认 sourceType 为 READING', async () => {
    const n = await noteService.create({ sourceId: SID, content: '这是一条笔记' });
    expect(n.sourceType).toBe(NOTE_SOURCE_TYPE.READING);
    expect(n.content).toBe('这是一条笔记');
    expect(n.tags).toBe('[]');
  });

  it('create 内容为空抛错（参数校验）', async () => {
    await expect(noteService.create({ sourceId: SID, content: '' })).rejects.toThrow('笔记内容不能为空');
  });

  it('create 序列化 tags', async () => {
    const n = await noteService.create({ sourceId: SID, content: '标签测试', tags: ['重点', '待复盘'] });
    expect(n.tags).toBe('["重点","待复盘"]');
  });

  it('create 接受合法 anchor 并原样存储', async () => {
    const n = await noteService.create({
      sourceId: SID,
      content: '锚点笔记',
      anchor: JSON.stringify({ start: 10, end: 25 }),
    });
    expect(JSON.parse(n.anchor)).toEqual({ start: 10, end: 25 });
  });

  it('create 拒绝非法 anchor（非 JSON / end < start / 负数）', async () => {
    await expect(noteService.create({
      sourceId: SID, content: 'x', anchor: 'not-json',
    })).rejects.toThrow();
    await expect(noteService.create({
      sourceId: SID, content: 'x', anchor: JSON.stringify({ start: 30, end: 10 }),
    })).rejects.toThrow();
    await expect(noteService.create({
      sourceId: SID, content: 'x', anchor: JSON.stringify({ start: -1, end: 5 }),
    })).rejects.toThrow();
  });

  it('listBySource 按来源精确筛选，且按创建时间升序', async () => {
    await noteService.create({ sourceType: NOTE_SOURCE_TYPE.READING, sourceId: SID, content: '第一条' });
    await noteService.create({ sourceType: NOTE_SOURCE_TYPE.READING, sourceId: 'TEST_READING_002', content: '别的来源' });
    await noteService.create({ sourceType: NOTE_SOURCE_TYPE.READING, sourceId: SID, content: '第二条' });

    const list = await noteService.listBySource(NOTE_SOURCE_TYPE.READING, SID);
    expect(list.length).toBe(2);
    expect(list[0].content).toBe('第一条');
    expect(list[1].content).toBe('第二条');
  });

  it('list 按 sourceType 筛选（跨来源）', async () => {
    await noteService.create({ sourceType: NOTE_SOURCE_TYPE.MEETING, sourceId: SID, content: '会议笔记' });
    const readings = await noteService.list({ sourceType: NOTE_SOURCE_TYPE.READING, sourceId: SID });
    const meetings = await noteService.list({ sourceType: NOTE_SOURCE_TYPE.MEETING, sourceId: SID });
    expect(readings.length).toBe(0);
    expect(meetings.length).toBe(1);
  });

  it('update 部分字段更新（只改 content 不影响 anchor）', async () => {
    const n = await noteService.create({
      sourceId: SID,
      content: '原文笔记',
      anchor: JSON.stringify({ start: 1, end: 2 }),
    });
    const upd = await noteService.update(n.id, { content: '修改后' });
    expect(upd.content).toBe('修改后');
    expect(JSON.parse(upd.anchor)).toEqual({ start: 1, end: 2 });
  });

  it('update 重新序列化 tags，空数组归位为 []', async () => {
    const n = await noteService.create({ sourceId: SID, content: 'x', tags: ['a'] });
    const upd = await noteService.update(n.id, { tags: [] });
    expect(upd.tags).toBe('[]');
  });

  it('getById / update / delete 对不存在的笔记抛 DB_NOT_FOUND', async () => {
    await expect(noteService.getById('not-exist-id')).rejects.toThrow('笔记不存在');
    await expect(noteService.update('not-exist-id', { content: 'x' })).rejects.toThrow('笔记不存在');
    await expect(noteService.delete('not-exist-id')).rejects.toThrow('笔记不存在');
  });

  it('delete 为软删除（记录仍在，deletedAt 有值，列表不再返回）', async () => {
    const n = await noteService.create({ sourceId: SID, content: '待删除' });
    await noteService.delete(n.id);
    const raw = await prisma.note.findUnique({ where: { id: n.id } });
    expect(raw).not.toBeNull();
    expect(raw.deletedAt).not.toBeNull();
    const list = await noteService.listBySource(NOTE_SOURCE_TYPE.READING, SID);
    expect(list.length).toBe(0);
  });
});
