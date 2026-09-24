/**
 * 本地 Agent 通道 - Service 服务层
 */
import agentRepository from './agent.repository.js';
import {
  runTask,
  submitTask,
  cancelTask,
  queueStats,
  recoverStaleTasks,
} from './job-runner.js';
import { getSkill, listSkills } from './skills/index.js';
import {
  createAgentTaskSchema,
  agentTaskIdSchema,
  listAgentTaskSchema,
} from './agent.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';

class AgentService {
  /**
   * 提交任务。默认创建后立即执行（autoRun=true）。
   * @param {object} payload { title?, prompt, skillKey?, autoRun? }
   */
  async create(payload = {}) {
    const data = createAgentTaskSchema.parse(payload);

    // 显式指定技能但不存在 → 直接拒绝，避免产生孤儿任务
    if (data.skillKey && data.skillKey !== 'auto' && !getSkill(data.skillKey)) {
      throw new BusinessError(ErrorCodes.AGENT_SKILL_NOT_FOUND, `技能不存在：${data.skillKey}`);
    }

    const title = data.title || this._deriveTitle(data.prompt);
    const task = await agentRepository.create({
      title,
      prompt: data.prompt,
      skillKey: data.skillKey || 'auto',
      status: 'pending',
    });

    if (data.autoRun) {
      // wait=true（默认）：等待执行完成，保持既有同步契约
      if (data.wait) {
        return this._withParsedResult(await runTask(task.id));
      }
      // wait=false：入队后立即返回 pending（真异步提交，结果稍后查详情）
      submitTask(task.id);
      return this._withParsedResult(await agentRepository.findById(task.id));
    }
    return this._withParsedResult(await agentRepository.findById(task.id));
  }

  _deriveTitle(prompt) {
    const t = String(prompt || '').replace(/\s+/g, ' ').trim();
    if (!t) return '未命名任务';
    return t.length > 40 ? `${t.slice(0, 40)}…` : t;
  }

  /** 重新执行指定任务 */
  async runNow(id) {
    agentTaskIdSchema.parse({ id });
    return this._withParsedResult(await runTask(id));
  }

  async getById(id) {
    agentTaskIdSchema.parse({ id });
    const task = await agentRepository.findById(id);
    if (!task) throw new BusinessError(ErrorCodes.AGENT_TASK_NOT_FOUND, '任务不存在或已删除');
    return this._withParsedResult(task);
  }

  async list(query = {}) {
    const q = listAgentTaskSchema.parse(query);
    const options = { orderBy: { createdAt: 'desc' } };
    if (q.status) options.where = { status: q.status };
    if (q.page && q.pageSize) {
      options.page = q.page;
      options.pageSize = q.pageSize;
    } else if (q.limit) {
      options.page = 1;
      options.pageSize = q.limit;
    }
    const res = await agentRepository.findMany(options);
    if (Array.isArray(res)) return res.map((t) => this._withParsedResult(t));
    return { ...res, list: res.list.map((t) => this._withParsedResult(t)) };
  }

  async remove(id) {
    agentTaskIdSchema.parse({ id });
    const exists = await agentRepository.findById(id);
    if (!exists) throw new BusinessError(ErrorCodes.AGENT_TASK_NOT_FOUND, '任务不存在或已删除');
    return agentRepository.softDeleteById(id);
  }

  /** 取消任务（仅排队中可取消，执行中会抛明确错误） */
  async cancel(id) {
    agentTaskIdSchema.parse({ id });
    return this._withParsedResult(await cancelTask(id));
  }

  /** 队列状态（可观测性） */
  async queueStats() {
    return queueStats();
  }

  /** 启动恢复：回收上次进程遗留的 running 僵尸任务 */
  async recoverStale() {
    return recoverStaleTasks();
  }

  async listSkills() {
    return listSkills();
  }

  /** 反序列化 result 字段为对象，便于前端直接消费 */
  _withParsedResult(task) {
    if (!task) return task;
    let result = null;
    if (task.result) {
      try {
        result = JSON.parse(task.result);
      } catch {
        result = { raw: task.result };
      }
    }
    return { ...task, result };
  }
}

export default new AgentService();
