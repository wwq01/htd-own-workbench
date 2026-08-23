/**
 * 投标档案模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class BidRepository extends BaseRepository {
  constructor() {
    super('bidArchive');
  }

  async list({ q, status, bidResult, projectMilestoneId, page, limit, sort, order } = {}) {
    const where = {};
    if (status) where.status = status;
    if (bidResult) where.bidResult = bidResult;
    if (projectMilestoneId) where.projectMilestoneId = projectMilestoneId;
    if (q) {
      where.OR = [
        { bidNo: { contains: q } },
        { bidVersion: { contains: q } },
      ];
    }
    const orderBy = sort
      ? [{ [sort]: order === 'asc' ? 'asc' : 'desc' }]
      : [{ sortOrder: 'asc' }, { createdAt: 'desc' }];
    return this.findMany({ where, orderBy, page, pageSize: limit });
  }
}

export default new BidRepository();
