/**
 * 开发项目模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class DevProjectRepository extends BaseRepository {
  constructor() {
    super('devProject');
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
      where.name = { contains: filters.keyword };
    }

    return this.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { updatedAt: 'desc' },
      ],
    });
  }
}

export default new DevProjectRepository();
