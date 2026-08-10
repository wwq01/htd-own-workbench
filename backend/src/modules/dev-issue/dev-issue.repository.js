/**
 * 开发问题模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class DevIssueRepository extends BaseRepository {
  constructor() {
    super('devIssue');
  }

  /**
   * 列表查询（支持按状态筛选、关键字搜索）
   */
  async listWithFilters(filters = {}) {
    const where = { deletedAt: null };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.keyword) {
      where.OR = [
        { title: { contains: filters.keyword } },
        { symptom: { contains: filters.keyword } },
        { investigation: { contains: filters.keyword } },
        { solution: { contains: filters.keyword } },
      ];
    }

    return this.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { status: 'asc' },
        { updatedAt: 'desc' },
      ],
    });
  }

  /**
   * 统计待解决问题数（待解决 + 排查中）
   */
  async countPending() {
    return this.count({
      status: { in: ['待解决', '排查中'] },
    });
  }
}

export default new DevIssueRepository();
