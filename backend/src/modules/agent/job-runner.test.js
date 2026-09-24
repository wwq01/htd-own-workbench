/**
 * JobRunner 队列调度测试（DB 相关部分）
 * 覆盖：wait:false 异步提交、取消排队中任务、取消执行中任务应报错、
 *       僵尸 running 回收、队列状态可观测。
 *
 * 说明：为让「排队中 / 执行中」可被确定观测，本文件注册一个测试专用慢技能
 * （vitest 默认按文件隔离模块，不会影响其他测试文件的技能计数断言）。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import agentService from './agent.service.js';
import { registerSkill } from './skills/index.js';
import { configureQueue, resetQueue } from './job-runner.js';

const prisma = new PrismaClient({
  datasourceUrl: process.env.HTD_TEST_DB_URL,
  log: ['error'],
});
const PREFIX = 'JOBRUNNER_TEST_';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 测试专用慢技能：确保任务能在「执行中」被稳定观测到
const SLOW_KEY = 'slow-test-skill';
registerSkill({
  key: SLOW_KEY,
  title: '测试用慢技能',
  description: '仅用于测试队列调度（延迟 200ms）',
  keywords: ['__slow_test__'],
  async run() {
    await sleep(200);
    return { ok: true };
  },
});

beforeAll(() => {
  // 并发 1：让第二个任务必然进入排队，便于确定性地测取消
  configureQueue({ concurrency: 1, timeoutMs: 5000 });
});

afterAll(async () => {
  await prisma.agentTask.deleteMany({ where: { prompt: { startsWith: PREFIX } } });
  resetQueue();
  await prisma.$disconnect();
});

describe('JobRunner 队列调度', () => {
  it('wait:false 应立即返回未完成任务，稍后自行完成', async () => {
    const t = await agentService.create({
      prompt: `${PREFIX}异步提交`,
      skillKey: SLOW_KEY,
      wait: false,
    });
    // 提交瞬间尚未执行完
    expect(['pending', 'running']).toContain(t.status);
    expect(t.result).toBeNull();

    // 等待其自行跑完
    await sleep(400);
    const done = await agentService.getById(t.id);
    expect(done.status).toBe('succeeded');
  });

  it('排队中的任务可被取消，状态落 cancelled', async () => {
    const a = await agentService.create({
      prompt: `${PREFIX}占位A`,
      skillKey: SLOW_KEY,
      wait: false,
    });
    await sleep(60); // 确保 A 已进入执行，占住唯一并发位

    const b = await agentService.create({
      prompt: `${PREFIX}排队B`,
      skillKey: SLOW_KEY,
      wait: false,
    });
    expect(b.status).toBe('pending'); // 并发=1，B 必然在排队

    const cancelled = await agentService.cancel(b.id);
    expect(cancelled.status).toBe('cancelled');

    await sleep(300); // 等 A 跑完，避免影响后续用例
    expect((await agentService.getById(a.id)).status).toBe('succeeded');
  });

  it('取消「执行中」的任务应抛明确错误（不静默假装成功）', async () => {
    const t = await agentService.create({
      prompt: `${PREFIX}执行中不可取消`,
      skillKey: SLOW_KEY,
      wait: false,
    });
    await sleep(60); // 确保已进入执行

    await expect(agentService.cancel(t.id)).rejects.toThrow(/正在执行/);

    await sleep(300);
    expect((await agentService.getById(t.id)).status).toBe('succeeded');
  });

  it('取消已终态任务应直接返回、不重复落库', async () => {
    const t = await agentService.create({ prompt: `${PREFIX}先跑完再取消` });
    expect(t.status).toBe('succeeded');
    const again = await agentService.cancel(t.id);
    expect(again.status).toBe('succeeded');
  });

  it('取消不存在的任务应报错', async () => {
    await expect(agentService.cancel('not-exist-id')).rejects.toThrow(/不存在/);
  });

  it('recoverStale 应把残留 running 回收为 failed', async () => {
    const t = await agentService.create({ prompt: `${PREFIX}僵尸`, autoRun: false });
    // 手工模拟「进程在执行中被杀」留下的僵尸状态
    await prisma.agentTask.update({ where: { id: t.id }, data: { status: 'running' } });

    const n = await agentService.recoverStale();
    expect(n).toBeGreaterThanOrEqual(1);

    const after = await agentService.getById(t.id);
    expect(after.status).toBe('failed');
    expect(after.error).toContain('进程重启');
  });

  it('queueStats 应返回队列可观测状态', async () => {
    const s = await agentService.queueStats();
    expect(s).toHaveProperty('queued');
    expect(s).toHaveProperty('running');
    expect(s).toHaveProperty('concurrency');
    expect(s).toHaveProperty('timeoutMs');
    expect(s.concurrency).toBe(1); // beforeAll 配置为 1
    expect(typeof s.timeoutMs).toBe('number');
  });
});
