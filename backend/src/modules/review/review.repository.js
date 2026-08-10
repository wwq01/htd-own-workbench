/**
 * 复盘模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';
import prisma from '../../database/prisma.js';

class ReviewRepository extends BaseRepository {
  constructor() {
    super('review');
  }

  /**
   * 列表查询（带 type/weekKey/projectId 筛选，可选带 project 关联）
   */
  async listWithFilters(filters = {}) {
    const where = { deletedAt: null };

    if (filters.type) where.type = filters.type;
    if (filters.weekKey) where.weekKey = filters.weekKey;
    if (filters.projectId) where.projectId = filters.projectId;

    return this.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * 查详情（projectId 为字符串关联，无 Prisma relation，需手动查 project）
   */
  async findDetailById(id) {
    return prisma.review.findFirst({
      where: { id, deletedAt: null },
    });
  }

  /**
   * 当前周是否已存在周复盘
   */
  async findCurrentWeek(weekKey) {
    return prisma.review.findFirst({
      where: { type: 'week', weekKey, deletedAt: null },
    });
  }
}

export default new ReviewRepository();
