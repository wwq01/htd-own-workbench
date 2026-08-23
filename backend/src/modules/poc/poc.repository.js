/**
 * POC 跟踪模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class PocRepository extends BaseRepository {
  constructor() {
    super('pocTracking');
  }

  async list({ q, status, projectId, page, limit, sort, order } = {}) {
    const where = {};
    if (status) where.status = status;
    if (projectId) where.projectId = projectId;
    if (q) {
      where.OR = [
        { goal: { contains: q } },
        { environment: { contains: q } },
        { result: { contains: q } },
      ];
    }
    const orderBy = sort
      ? [{ [sort]: order === 'asc' ? 'asc' : 'desc' }]
      : [{ sortOrder: 'asc' }, { createdAt: 'desc' }];
    return this.findMany({ where, orderBy, page, pageSize: limit });
  }
}

export default new PocRepository();
