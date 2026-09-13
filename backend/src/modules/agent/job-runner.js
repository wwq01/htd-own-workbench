/**
 * JobRunner：本地任务执行器
 * 负责完整状态机：pending → running → succeeded / failed。
 * MVP 为进程内同步执行（技能均为轻量本地逻辑）；结构上预留异步队列扩展点。
 */
import agentRepository from './agent.repository.js';
import { resolveSkill } from './skills/index.js';
import prisma from '../../database/prisma.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';

/**
 * 执行指定任务。调用方需保证 taskId 对应任务存在。
 * @returns {Promise<object>} 执行后的任务记录（result 为 JSON 字符串）
 */
export async function runTask(taskId) {
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
