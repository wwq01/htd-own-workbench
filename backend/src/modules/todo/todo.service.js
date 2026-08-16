/**
 * 待办模块 - Service 服务层
 */
import todoRepository from './todo.repository.js';
import {
  createTodoSchema,
  updateTodoSchema,
  listTodoSchema,
  migratePendingSchema,
  todoIdSchema,
} from './todo.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { today, tomorrow } from '../../common/utils/date.js';
import { createStateMachine } from '../../lib/stateMachine.js';
import { TODO_STATUS, TODO_STATUS_TRANSITIONS } from '../../common/constants/enums.js';

class TodoService {
  /**
   * 新增待办
   */
  async create(payload) {
    const data = createTodoSchema.parse(payload);
    return todoRepository.create({
      title: data.title,
      category: data.category,
      priority: data.priority,
      todoDate: data.todoDate,
      status: data.status || 'pending',
      estimatedTime: data.estimatedTime || null,
      remark: data.remark || null,
      sortOrder: data.sortOrder ?? 0,
    });
  }

  /**
   * 编辑待办（部分字段更新）
   */
  async update(payload) {
    const parsed = updateTodoSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await todoRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '待办不存在');
    }

    const updateData = { ...fields };
    // 若 status 改为 completed 且原本不是 → 补 completedAt
    if (fields.status === 'completed' && exists.status !== 'completed') {
      updateData.completedAt = new Date();
    }
    // 若 status 改为 pending 且原本 completed → 清掉 completedAt
    if (fields.status === 'pending' && exists.status === 'completed') {
      updateData.completedAt = null;
    }
    // 空字符串处理为 null（estimatedTime/remark）
    if ('estimatedTime' in updateData && updateData.estimatedTime === '') updateData.estimatedTime = null;
    if ('remark' in updateData && updateData.remark === '') updateData.remark = null;
    // 延期日期：空字符串 → null；有值 → Date
    if ('delayedUntil' in updateData) {
      updateData.delayedUntil = updateData.delayedUntil ? new Date(`${updateData.delayedUntil}T00:00:00`) : null;
    }

    return todoRepository.updateById(id, updateData);
  }

  /**
   * 软删除待办
   */
  async delete(id) {
    todoIdSchema.parse({ id });
    const exists = await todoRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '待办不存在');
    }
    return todoRepository.softDeleteById(id);
  }

  /**
   * 根据 ID 获取详情
   */
  async getById(id) {
    todoIdSchema.parse({ id });
    const todo = await todoRepository.findById(id);
    if (!todo) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '待办不存在');
    }
    return todo;
  }

  /**
   * 切换完成状态（pending ↔ completed）
   */
  async toggleStatus(id) {
    todoIdSchema.parse({ id });
    const exists = await todoRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '待办不存在');
    }
    const nextStatus = exists.status === 'completed' ? 'pending' : 'completed';
    const updateData = { status: nextStatus };
    if (nextStatus === 'completed') updateData.completedAt = new Date();
    else updateData.completedAt = null;
    return todoRepository.updateById(id, updateData);
  }

  /**
   * 通用状态切换（受 5 态状态机约束）
   * 合法迁移见 TODO_STATUS_TRANSITIONS；非法迁移抛 BusinessError
   */
  async changeStatus(id, toStatus) {
    todoIdSchema.parse({ id });
    if (!Object.values(TODO_STATUS).includes(toStatus)) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, `非法的任务状态「${toStatus}」`);
    }
    const exists = await todoRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '待办不存在');
    }
    const sm = createStateMachine({ name: 'TodoStatus', ALLOWED_TRANSITIONS: TODO_STATUS_TRANSITIONS });
    await sm.transition(exists.status, toStatus);
    const updateData = { status: toStatus };
    if (toStatus === 'completed') updateData.completedAt = new Date();
    else updateData.completedAt = null;
    // 离开延期态时清空延期目标
    if (toStatus !== 'delayed') updateData.delayedUntil = null;
    return todoRepository.updateById(id, updateData);
  }

  /**
   * 延期操作（§6.2.1 任务 5 态）
   * 不传 toDate 默认延期到明天；延期后状态切 DELAYED 并记录 delayedUntil，
   * 同时将归属日期 todoDate 顺延到目标日期（从今日列表移出）
   */
  async delayTodo(id, payload = {}) {
    todoIdSchema.parse({ id });
    const exists = await todoRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '待办不存在');
    }
    if (exists.status === 'completed') {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, '已完成的任务不能延期');
    }
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const toDate = payload && DATE_RE.test(payload.toDate) ? payload.toDate : tomorrow();
    const sm = createStateMachine({ name: 'TodoStatus', ALLOWED_TRANSITIONS: TODO_STATUS_TRANSITIONS });
    await sm.transition(exists.status, 'delayed');
    return todoRepository.updateById(id, {
      status: 'delayed',
      todoDate: toDate,
      delayedUntil: new Date(`${toDate}T00:00:00`),
      completedAt: null,
    });
  }

  /**
   * 列表查询（支持按单日期 或 日期范围）
   */
  async list(query = {}) {
    const q = listTodoSchema.parse(query);
    if (q.todoDate) {
      return todoRepository.listByDate(q.todoDate, {
        category: q.category,
        status: q.status,
        priority: q.priority,
      });
    }
    if (q.startDate && q.endDate) {
      return todoRepository.listByDateRange(q.startDate, q.endDate, {
        category: q.category,
        status: q.status,
        priority: q.priority,
      });
    }
    // 默认：今日列表
    return todoRepository.listByDate(today(), {
      category: q.category,
      status: q.status,
      priority: q.priority,
    });
  }

  /**
   * 迁移未完成待办：fromDate → toDate
   * 今日 → 明日 或 明日 → 今日 通用
   */
  async migratePendingToDate(payload) {
    const { fromDate, toDate, ids } = migratePendingSchema.parse(payload);
    // 构造 where 条件
    let targetItems;
    if (ids && ids.length > 0) {
      targetItems = await todoRepository.findAll({ id: { in: ids }, todoDate: fromDate });
    } else {
      // 默认：迁移所有 pending
      targetItems = await todoRepository.findAll({ todoDate: fromDate, status: 'pending' });
    }

    if (!targetItems.length) {
      return { movedCount: 0, skippedCount: 0 };
    }

    const idsToMove = targetItems.map(t => t.id);
    const r = await todoRepository.bulkUpdateTodoDate(idsToMove, toDate);
    return {
      movedCount: r.count,
      skippedCount: targetItems.length - r.count,
      migratedIds: idsToMove,
    };
  }

  /**
   * 便捷：今日未完成 → 明日
   */
  async migrateTodayPendingToTomorrow() {
    return this.migratePendingToDate({
      fromDate: today(),
      toDate: tomorrow(),
    });
  }

  /**
   * 便捷：明日所有待办 → 今日（无论状态）
   */
  async migrateAllTomorrowToToday() {
    const fromDate = tomorrow();
    const toDate = today();
    const items = await todoRepository.findAll({ todoDate: fromDate });
    if (!items.length) return { movedCount: 0, skippedCount: 0, migratedIds: [] };
    const ids = items.map(t => t.id);
    const r = await todoRepository.bulkUpdateTodoDate(ids, toDate);
    return { movedCount: r.count, skippedCount: items.length - r.count, migratedIds: ids };
  }

  /**
   * 历史日期回看
   */
  async listHistory(date) {
    // 单日期 = listByDate
    return todoRepository.listByDate(date);
  }

  /**
   * 简单统计（某日期 pending/completed 数量）
   */
  async getStatsForDate(date) {
    const pending = await todoRepository.count({ todoDate: date, status: 'pending' });
    const completed = await todoRepository.count({ todoDate: date, status: 'completed' });
    return { date, pending, completed, total: pending + completed };
  }
}

export default new TodoService();
