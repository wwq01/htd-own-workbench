import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import searchService from './search.service.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'SRCH_';

async function cleanup() {
  await prisma.readingMaterial.deleteMany({ where: { title: { contains: PREFIX } } });
  await prisma.project.deleteMany({ where: { customerName: { contains: PREFIX } } });
}

describe('Search Service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('空关键词返回空结果', async () => {
    const r = await searchService.search({ q: '' });
    expect(r).toEqual({ groups: [], total: 0 });
  });

  it('跨模块搜索命中多个模块并按组返回', async () => {
    await prisma.readingMaterial.create({ data: { title: `${PREFIX}零信任架构` } });
    await prisma.project.create({ data: { customerName: `${PREFIX}零信任项目` } });

    const r = await searchService.search({ q: '零信任' });
    const modules = r.groups.map((g) => g.module);
    expect(modules).toContain('reading');
    expect(modules).toContain('project');
    expect(r.total).toBeGreaterThanOrEqual(2);
  });

  it('modules 过滤仅搜索指定模块', async () => {
    await prisma.readingMaterial.create({ data: { title: `${PREFIX}过滤测试` } });
    await prisma.project.create({ data: { customerName: `${PREFIX}过滤测试` } });

    const r = await searchService.search({ q: '过滤测试', modules: 'reading' });
    expect(r.groups.length).toBe(1);
    expect(r.groups[0].module).toBe('reading');
  });

  it('结果项含 id/title/snippet/route', async () => {
    await prisma.readingMaterial.create({ data: { title: `${PREFIX}字段校验`, notes: '这是一段用于摘要截取的笔记内容' } });
    const r = await searchService.search({ q: '字段校验' });
    const item = r.groups[0].items[0];
    expect(item.id).toBeTruthy();
    expect(item.title).toContain('字段校验');
    expect(item.route).toBe('/reading');
    expect(typeof item.snippet).toBe('string');
  });
});

afterAll(async () => { await prisma.$disconnect(); });
