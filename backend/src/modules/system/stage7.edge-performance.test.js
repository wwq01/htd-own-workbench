import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import createApp from '../../app.js';

let server;
let baseUrl;

async function rawRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  return { status: response.status, body: await response.json() };
}

describe('阶段 7 边缘场景与性能验证', () => {
  beforeAll(async () => {
    const app = createApp();
    server = await new Promise((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('应友好拒绝非法输入、未知路由和无效导入', async () => {
    const invalidTodo = await rawRequest('/todos', {
      method: 'POST',
      body: JSON.stringify({ title: '', todoDate: 'not-a-date' }),
    });
    expect(invalidTodo.status).toBe(400);
    expect(invalidTodo.body.code).not.toBe(0);

    const unknownRoute = await rawRequest('/route-that-does-not-exist');
    expect(unknownRoute.status).toBe(404);
    expect(unknownRoute.body.code).not.toBe(0);

    const invalidImport = await rawRequest('/system/data/import', {
      method: 'POST',
      body: JSON.stringify({ invalid: true }),
    });
    expect(invalidImport.status).toBe(400);
    expect(invalidImport.body.code).not.toBe(0);
  });

  it('统计接口应在重复请求下保持稳定响应时间', async () => {
    const startedAt = performance.now();
    const responses = [];
    for (let i = 0; i < 20; i++) {
      responses.push(await rawRequest('/system/data-stats'));
    }
    const elapsedMs = performance.now() - startedAt;
    expect(responses.every((item) => item.status === 200 && item.body.code === 0)).toBe(true);
    expect(elapsedMs).toBeLessThan(5000);
  });
});
