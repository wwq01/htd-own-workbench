/**
 * 通用队列单测（纯逻辑，无数据库依赖）
 * 覆盖：并发上限、执行顺序、超时、取消、去重、状态统计。
 */
import { describe, expect, it } from 'vitest';
import { createQueue } from './job-queue.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('job-queue 通用队列', () => {
  it('正常执行并 resolve 结果', async () => {
    const q = createQueue({ concurrency: 2, timeoutMs: 1000 });
    await expect(q.enqueue('a', async () => 42)).resolves.toBe(42);
    expect(q.stats()).toEqual({ queued: 0, running: 0, concurrency: 2, timeoutMs: 1000 });
  });

  it('执行体抛错时应 reject', async () => {
    const q = createQueue();
    await expect(
      q.enqueue('boom', async () => {
        throw new Error('执行失败');
      }),
    ).rejects.toThrow('执行失败');
  });

  it('并发上限：并发=1 时同时只有 1 个在执行', async () => {
    const q = createQueue({ concurrency: 1, timeoutMs: 2000 });
    let concurrent = 0;
    let maxConcurrent = 0;
    const job = async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await sleep(30);
      concurrent -= 1;
    };
    await Promise.all([
      q.enqueue('j1', job),
      q.enqueue('j2', job),
      q.enqueue('j3', job),
    ]);
    expect(maxConcurrent).toBe(1);
  });

  it('并发上限：并发=2 时同时最多 2 个，且排队数可见', async () => {
    const q = createQueue({ concurrency: 2, timeoutMs: 2000 });
    let concurrent = 0;
    let maxConcurrent = 0;
    const job = async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await sleep(40);
      concurrent -= 1;
    };
    const promises = [
      q.enqueue('j1', job),
      q.enqueue('j2', job),
      q.enqueue('j3', job),
      q.enqueue('j4', job),
    ];
    // 此刻应有 2 个在跑、2 个排队
    await sleep(5);
    const s = q.stats();
    expect(s.running).toBe(2);
    expect(s.queued).toBe(2);
    await Promise.all(promises);
    expect(maxConcurrent).toBe(2);
  });

  it('并发=1 时按提交顺序执行', async () => {
    const q = createQueue({ concurrency: 1, timeoutMs: 2000 });
    const order = [];
    const mk = (id, ms) => async () => {
      await sleep(ms);
      order.push(id);
      return id;
    };
    await Promise.all([
      q.enqueue('a', mk('a', 30)),
      q.enqueue('b', mk('b', 10)),
      q.enqueue('c', mk('c', 1)),
    ]);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('超时：超过 timeoutMs 应 reject 且让出并发位', async () => {
    const q = createQueue({ concurrency: 1, timeoutMs: 50 });
    await expect(
      q.enqueue('slow', () => sleep(300)),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });

    // 超时后并发位应释放，后续任务可执行
    await expect(q.enqueue('next', async () => 'ok')).resolves.toBe('ok');
    expect(q.stats().running).toBe(0);
  });

  it('取消排队中的任务：reject 且不再执行', async () => {
    const q = createQueue({ concurrency: 1, timeoutMs: 2000 });
    let started = 0;
    const blocker = q.enqueue('blocker', () => sleep(120));
    const victim = q.enqueue('victim', async () => {
      started += 1;
      return '不该执行';
    });

    expect(q.isQueued('victim')).toBe(true);
    expect(q.cancel('victim')).toBe(true);

    await expect(victim).rejects.toMatchObject({ code: 'CANCELLED' });
    await blocker;
    await sleep(20);
    expect(started).toBe(0);
  });

  it('取消不在队列中的任务返回 false', async () => {
    const q = createQueue();
    expect(q.cancel('not-exist')).toBe(false);
  });

  it('同一 id 重复入队应 reject（防重跑风暴）', async () => {
    const q = createQueue({ concurrency: 1, timeoutMs: 1000 });
    const first = q.enqueue('dup', () => sleep(50));
    await expect(q.enqueue('dup', async () => 1)).rejects.toMatchObject({ code: 'DUPLICATE' });
    await first;
  });

  it('isRunning / isQueued 状态判定正确', async () => {
    const q = createQueue({ concurrency: 1, timeoutMs: 1000 });
    const p = q.enqueue('r1', () => sleep(60));
    await sleep(5);
    expect(q.isRunning('r1')).toBe(true);
    expect(q.isQueued('r1')).toBe(false);
    await p;
    expect(q.isRunning('r1')).toBe(false);
  });
});
