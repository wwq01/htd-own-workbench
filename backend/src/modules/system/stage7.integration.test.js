import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import createApp from '../../app.js';
import prisma from '../../database/prisma.js';

const PREFIX = 'TEST_STAGE7_';
let server;
let baseUrl;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json();
  expect(response.ok).toBe(true);
  expect(body.code).toBe(0);
  return body.data;
}

describe('阶段 7 HTTP 集成验证', () => {
  beforeAll(async () => {
    const app = createApp();
    server = await new Promise((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  });

  beforeEach(async () => {
    await prisma.todo.deleteMany({ where: { title: { startsWith: PREFIX } } });
  });

  afterAll(async () => {
    await prisma.todo.deleteMany({ where: { title: { startsWith: PREFIX } } });
    await new Promise((resolve) => server.close(resolve));
  });

  it('应通过真实 HTTP 完成待办新增、读取、修改、切换和删除', async () => {
    const created = await request('/todos', {
      method: 'POST',
      body: JSON.stringify({ title: `${PREFIX}创建`, todoDate: '2026-08-10' }),
    });
    expect(created.title).toBe(`${PREFIX}创建`);

    const list = await request('/todos?todoDate=2026-08-10');
    expect(list.some((item) => item.id === created.id)).toBe(true);

    const updated = await request(`/todos/${created.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title: `${PREFIX}修改后` }),
    });
    expect(updated.title).toBe(`${PREFIX}修改后`);

    const toggled = await request(`/todos/${created.id}/toggle`, { method: 'POST' });
    expect(toggled.status).toBe('completed');

    await request(`/todos/${created.id}`, { method: 'DELETE' });
    const remaining = await request('/todos?todoDate=2026-08-10');
    expect(remaining.some((item) => item.id === created.id)).toBe(false);
  });

  it('应通过真实 HTTP 访问系统健康、统计、设置和数据导出接口', async () => {
    const health = await request('/system/health');
    expect(health.status).toBe('ok');

    const stats = await request('/system/data-stats');
    expect(stats.totalCount).toEqual(expect.any(Number));
    expect(stats.stats.length).toBe(14);

    const settings = await request('/system/settings');
    expect(['dark', 'light']).toContain(settings.theme);

    const exported = await request('/system/data/export');
    expect(exported.version).toBe('1.0');
    expect(Object.keys(exported.tables).length).toBe(14);
  });
});
