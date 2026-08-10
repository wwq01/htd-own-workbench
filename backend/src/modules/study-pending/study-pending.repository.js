/**
 * 待学清单模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class StudyPendingRepository extends BaseRepository {
  constructor() {
    super('studyPending');
  }

  /**
   * 列表查询（支持按完成状态筛选）
   */
  async listWithFilters(filters = {}) {
    const where = { deletedAt: null };

    if (filters.completed !== undefined && filters.completed !== '') {
      where.completed = filters.completed === 'true' || filters.completed === true;
    }

    return this.findMany({
      where,
      orderBy: [
        { completed: 'asc' },
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }
}

export default new StudyPendingRepository();
