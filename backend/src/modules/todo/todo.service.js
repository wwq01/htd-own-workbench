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
