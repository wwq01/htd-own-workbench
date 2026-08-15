/**
 * StudyRecord 模块测试（阶段3）
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createStudyRecordSchema, updateStudyRecordSchema } from './study-record.schema.js';
import studyRecordService from './study-record.service.js';
import { STUDY_TYPE } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';
const TODAY = '2026-08-10';

describe('StudyRecord Schema 校验', () => {
  it('合法数据应通过校验', () => {
    const data = createStudyRecordSchema.parse({ topic: `${PREFIX}学习Vue3`, studyDate: TODAY, duration: 2 });
    expect(data.topic).toBe(`${PREFIX}学习Vue3`);
    expect(data.type).toBe(STUDY_TYPE.PROFESSIONAL);
    expect(data.duration).toBe(2);
  });
  it('主题为空应拒绝', () => {
    expect(createStudyRecordSchema.safeParse({ topic: '', studyDate: TODAY }).success).toBe(false);
  });
  it('非法日期格式应拒绝', () => {
    expect(createStudyRecordSchema.safeParse({ topic: 'test', studyDate: '2026/08/10' }).success).toBe(false);
  });
  it('学习时长超限应拒绝', () => {
    expect(createStudyRecordSchema.safeParse({ topic: 'test', studyDate: TODAY, duration: 25 }).success).toBe(false);
  });
  it('负学习时长应拒绝', () => {
    expect(createStudyRecordSchema.safeParse({ topic: 'test', studyDate: TODAY, duration: -1 }).success).toBe(false);
  });
});

describe('StudyRecord Service 集成测试', () => {
  beforeEach(async () => { await prisma.studyRecord.deleteMany({ where: { topic: { startsWith: PREFIX } } }); });
  afterEach(async () => { await prisma.studyRecord.deleteMany({ where: { topic: { startsWith: PREFIX } } }); });

  it('应成功创建学习记录', async () => {
    const created = await studyRecordService.create({ topic: `${PREFIX}创建`, studyDate: TODAY, duration: 1.5 });
    expect(created.id).toBeTruthy();
    expect(created.topic).toBe(`${PREFIX}创建`);
    expect(created.duration).toBe(1.5);
  });

  it('应支持更新', async () => {
    const r = await studyRecordService.create({ topic: `${PREFIX}更新`, studyDate: TODAY, duration: 1 });
    const updated = await studyRecordService.update({ id: r.id, duration: 3, notes: '学到了很多' });
    expect(updated.duration).toBe(3);
    expect(updated.notes).toBe('学到了很多');
  });

  it('应支持按类型筛选', async () => {
    await studyRecordService.create({ topic: `${PREFIX}筛选A`, studyDate: TODAY, type: '专业学习' });
    await studyRecordService.create({ topic: `${PREFIX}筛选B`, studyDate: TODAY, type: '通用学习' });
    const list = await studyRecordService.list({ type: '专业学习' });
    expect(list.some(r => r.topic === `${PREFIX}筛选A`)).toBe(true);
    expect(list.some(r => r.topic === `${PREFIX}筛选B`)).toBe(false);
  });

  it('应支持时长统计', async () => {
    await studyRecordService.create({ topic: `${PREFIX}统计1`, studyDate: TODAY, duration: 2 });
    await studyRecordService.create({ topic: `${PREFIX}统计2`, studyDate: TODAY, duration: 3 });
    const stats = await studyRecordService.getDurationStats();
    expect(typeof stats.weekHours).toBe('number');
    expect(typeof stats.monthHours).toBe('number');
  });

  it('不存在的 ID 应抛出错误', async () => {
    await expect(studyRecordService.getById('non-existent')).rejects.toThrow('学习记录不存在');
  });

  it('应支持软删除', async () => {
    const r = await studyRecordService.create({ topic: `${PREFIX}删除`, studyDate: TODAY });
    await studyRecordService.delete(r.id);
    const raw = await prisma.studyRecord.findUnique({ where: { id: r.id } });
    expect(raw.deletedAt).not.toBeNull();
  });
});

afterAll(async () => { await prisma.$disconnect(); });
