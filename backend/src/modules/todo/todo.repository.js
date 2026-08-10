/**
 * 待办模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';
import prisma from '../../database/prisma.js';

class TodoRepository extends BaseRepository {
  constructor() {
    super('todo');
  }

  /**
   * 按日期查询待办列表（支持筛选）
   * @param {string} todoDate  YYYY-MM-DD
   * @param {object} filters    {category?, status?, priority?}
   */
  async listByDate(todoDate, filters = {}) {
    const where = { todoDate };
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;

    return this.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * 按日期范围查询（历史回看）
   */
  async listByDateRange(startDate, endDate, filters = {}) {
    const where = {
      todoDate: { gte: startDate, lte: endDate },
    };
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;

    return this.findMany({
      where,
      orderBy: [
        { todoDate: 'desc' },
        { sortOrder: 'asc' },
      ],
    });
  }

  /**
   * 统计某日未完成数
   */
  async countPendingByDate(todoDate) {
    return this.count({ todoDate, status: 'pending' });
  }

  /**
   * 批量更新 todoDate（用于今日↔明日迁移）
   */
  async bulkUpdateTodoDate(ids, newTodoDate) {
    return prisma.todo.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { todoDate: newTodoDate },
    });
  }
}

export default new TodoRepository();
