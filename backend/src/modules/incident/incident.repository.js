/**
 * 应急响应记录模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class IncidentRepository extends BaseRepository {
  constructor() {
    super('emergencyResponse');
  }

  async list({ q, status, severity, page, limit, sort, order } = {}) {
    const where = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { review: { contains: q } },
      ];
    }
    const orderBy = sort
      ? [{ [sort]: order === 'asc' ? 'asc' : 'desc' }]
      : [{ sortOrder: 'asc' }, { createdAt: 'desc' }];
    return this.findMany({ where, orderBy, page, pageSize: limit });
  }
}

export default new IncidentRepository();
