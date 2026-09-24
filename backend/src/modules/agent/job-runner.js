/**
 * JobRunner：本地任务执行器（队列调度版）
 *
 * 职责拆分：
 * - executeTask()  纯执行体：pending → running → succeeded / failed（不关心谁调度）
 * - submitTask()   入队，不等待（fire-and-forget，供 wait:false 使用）
 * - runTask()      入队 + 等待（保持既有同步语义，现有测试零改动）
 *
 * 状态机：pending → running → succeeded | failed；排队阶段可 → cancelled
 * 状态以 agent_tasks 表为准（单一事实来源），内存队列仅负责调度与背压。
 */
import agentRepository from './agent.repository.js';
import { resolveSkill } from './skills/index.js';
import { createQueue } from './job-queue.js';
import prisma from '../../database/prisma.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';

/** 默认并发 2：SQLite 单写者，避免技能并发写竞争 */
const DEFAULT_CONCURRENCY = 2;
/** 默认单任务超时 30s：防慢技能永久挂住调用方 */
const DEFAULT_TIMEOUT_MS = 30000;

let queue = createQueue({ concurrency: DEFAULT_CONCURRENCY, timeoutMs: DEFAULT_TIMEOUT_MS });

/** 重新配置队列（主要用于测试与调优） */
export function configureQueue(options = {}) {
  queue = createQueue({
    concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
  return queue.stats();
}

/** 恢复默认配置 */
export function resetQueue() {
  return configureQueue({});
}

/** 当前队列（供可观测与取消判定） */
export function getQueue() {
  return queue;
}

/** 队列状态快照 */
export function queueStats() {
  return queue.stats();
}

/**
 * 执行指定任务（纯执行体，不做调度）。
 * 调用方需保证 taskId 对应任务存在。
 * @returns {Promise<object>} 执行后的任务记录（result 为 JSON 字符串）
 */
export async function executeTask(taskId) {
  const task = await agentRepository.findById(taskId);
  if (!task) {
    throw new BusinessError(ErrorCodes.AGENT_TASK_NOT_FOUND, '任务不存在或已删除');
  }

  // 解析技能（显式指定不存在会在此抛出 AGENT_SKILL_NOT_FOUND）
  const skill = resolveSkill(task.skillKey, task.prompt);

  // 进入 running
  await agentRepository.updateById(taskId, {
    status: 'running',
    startedAt: new Date(),
    error: null,
  });

  try {
    const output = await skill.run({ prisma, prompt: task.prompt });
    await agentRepository.updateById(taskId, {
      status: 'succeeded',
      result: JSON.stringify({ skill: skill.key, output }),
      finishedAt: new Date(),
    });
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    await agentRepository.updateById(taskId, {
      status: 'failed',
      error: msg,
      finishedAt: new Date(),
    });
    // 任务级失败：状态已落库，向上抛出供接口返回
    throw new BusinessError(ErrorCodes.AGENT_RUN_FAILED, msg);
  }

  return agentRepository.findById(taskId);
}

/**
 * 提交任务到队列（不等待执行结果）。
 * 注意：内部已挂 catch，避免 fire-and-forget 场景产生 unhandled rejection。
 * @returns {Promise<object>} 执行后的任务记录（调用方可选择 await）
 */
export function submitTask(taskId) {
  const promise = queue.enqueue(taskId, () => executeTask(taskId));
  promise.catch(() => {}); // 静默兜底，await 方仍能看到拒绝
  return promise;
}

/**
 * 提交并等待执行完成（既有同步语义，保持 API 契约不变）。
 * @returns {Promise<object>} 执行后的任务记录
 */
export async function runTask(taskId) {
  return submitTask(taskId);
}

/**
 * 取消任务。
 * 只能取消「排队中」的任务——已开始执行的同步技能无法安全中断，
 * 此时抛明确业务错误而非静默假装成功。
 * @returns {Promise<object>} 取消后的任务记录
 */
export async function cancelTask(taskId) {
  const task = await agentRepository.findById(taskId);
  if (!task) {
    throw new BusinessError(ErrorCodes.AGENT_TASK_NOT_FOUND, '任务不存在或已删除');
  }

  // 已终态：直接返回，不重复落库
  if (['succeeded', 'failed', 'cancelled'].includes(task.status)) {
    return task;
  }

  if (queue.isRunning(taskId)) {
    throw new BusinessError(
      ErrorCodes.AGENT_TASK_CANCEL_NOT_ALLOWED,
      '任务正在执行，无法取消（同步技能无法安全中断）',
    );
  }

  // 仍在排队 → 移出队列；不在队列（如 pending 未提交）→ 直接落库取消
  queue.cancel(taskId);
  await agentRepository.updateById(taskId, {
    status: 'cancelled',
    error: '已取消',
    finishedAt: new Date(),
  });
  return agentRepository.findById(taskId);
}

/**
 * 回收僵尸任务：把库中残留的 running 置为 failed。
 * 内存队列随进程消亡，故启动时仍是 running 的必是上次进程被中断留下的。
 * @returns {Promise<number>} 回收数量
 */
export async function recoverStaleTasks() {
  const res = await agentRepository.update(
    { status: 'running' },
    { status: 'failed', error: '进程重启中断执行', finishedAt: new Date() },
  );
  return Number(res?.count || 0);
}
