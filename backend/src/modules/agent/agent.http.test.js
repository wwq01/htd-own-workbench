/**
 * Agent 路由 HTTP 集成验证（T3 验收）
 * 参考 backend/src/modules/system/stage7.integration.test.js 的 in-process 模式：
 * 用 createApp() + app.listen(0, '127.0.0.1') 起临时服务，真实 fetch 调用 /agent 路由，
 * 不依赖外部端口、不 spawn 子进程（沙箱禁止子进程网络互通）。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import createApp from '../../app.js';
import prisma from '../../database/prisma.js';
import { listSkills } from './skills/index.js';

let server;
let baseUrl;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  expect(response.ok).toBe(true);
  expect(body.code).toBe(0);
  return body.data;
}

describe('Agent 路由 HTTP 集成验证', () => {
  beforeAll(async () => {
    const app = createApp();
    server = await new Promise((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
    // 清空历史 agent_tasks，保证断言不受其他测试文件共享库污染
    await prisma.agentTask.deleteMany({});
  });

  afterAll(async () => {
    await prisma.agentTask.deleteMany({});
    await new Promise((resolve) => server.close(resolve));
  });

  it('GET /agent/skills 应返回全部 8 个已注册技能', async () => {
    const skills = await request('/agent/skills');
    expect(skills.length).toBe(listSkills().length);
    expect(skills.length).toBe(8);
    const keys = skills.map((s) => s.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'vault-digest',
        'todo-extract',
        'db-health',
        'generic',
        'weekly-report',
        'habit-stats',
        'finance-summary',
        'project-burndown',
      ]),
    );
  });

  it('POST /agent/tasks 走 vault 提示词应命中 vault-digest 并完成', async () => {
    const task = await request('/agent/tasks', {
      method: 'POST',
      body: JSON.stringify({ prompt: '总结一下我的 vault 沉淀库' }),
    });
    expect(task.status).toBe('succeeded');
    expect(task.result.skill).toBe('vault-digest');
  });

  it('POST /agent/tasks 走 generic 提示词应命中 generic 兜底', async () => {
    const task = await request('/agent/tasks', {
      method: 'POST',
      body: JSON.stringify({ prompt: '今天天气真不错随便聊聊' }),
    });
    expect(task.status).toBe('succeeded');
    expect(task.result.skill).toBe('generic');
  });

  it('POST /agent/tasks 走 habit 提示词应命中 habit-stats', async () => {
    const task = await request('/agent/tasks', {
      method: 'POST',
      body: JSON.stringify({ prompt: '统计一下我的习惯打卡情况' }),
    });
    expect(task.status).toBe('succeeded');
    expect(task.result.skill).toBe('habit-stats');
  });

  it('POST /agent/tasks 走 weekly 提示词应命中 weekly-report', async () => {
    const task = await request('/agent/tasks', {
      method: 'POST',
      body: JSON.stringify({ prompt: '生成本周工作周报' }),
    });
    expect(task.status).toBe('succeeded');
    expect(task.result.skill).toBe('weekly-report');
  });

  it('GET /agent/tasks/:id 应返回带解析结果的详情', async () => {
    const created = await request('/agent/tasks', {
      method: 'POST',
      body: JSON.stringify({ prompt: '生成本周工作周报' }),
    });
    const detail = await request(`/agent/tasks/${created.id}`);
    expect(detail.id).toBe(created.id);
    expect(detail.result.skill).toBe('weekly-report');
    expect(detail.result.output).toHaveProperty('weekStart');
    expect(detail.result.output.total).toHaveProperty('待办');
  });
});
