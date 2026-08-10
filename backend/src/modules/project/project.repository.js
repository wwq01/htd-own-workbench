/**
 * 项目模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';
import prisma from '../../database/prisma.js';

class ProjectRepository extends BaseRepository {
  constructor() {
    super('project');
  }

  /**
   * 按 ID 查询项目详情（含里程碑 + 任务）
   */
  async findDetailById(id) {
    return this.findById(id, {
      include: {
        milestones: {
          where: { deletedAt: null },
          orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }, { sortOrder: 'asc' }],
        },
        tasks: {
          where: { deletedAt: null },
          orderBy: [{ completed: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  /**
   * 列表查询（支持按阶段、安全领域、优先级筛选）
   * @param {object} filters { phase?, securityDomain?, priority?, keyword? }
   */
  async listWithFilters(filters = {}) {
    const where = { deletedAt: null };

    if (filters.phase) {
      where.phase = filters.phase;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    // 关键字模糊匹配客户名称
    if (filters.keyword) {
      where.customerName = { contains: filters.keyword };
    }

    // 安全领域筛选：由于 securityDomains 存为 JSON 字符串数组
    // SQLite 不支持原生 JSON 数组包含查询，使用字符串 contains 模糊匹配
    if (filters.securityDomain) {
      where.securityDomains = { contains: `"${filters.securityDomain}"` };
    }

    return this.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { updatedAt: 'desc' },
      ],
    });
  }

  /**
   * 查询所有进行中的项目（首页统计用）
   */
  async listInProgress() {
    return this.findMany({
      where: {
        deletedAt: null,
        NOT: { phase: '项目结项' },
      },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });
  }
}

export default new ProjectRepository();
