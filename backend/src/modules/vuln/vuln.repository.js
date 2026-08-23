/**
 * 漏洞跟踪库模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class VulnRepository extends BaseRepository {
  constructor() {
    super('vulnTrack');
  }

  async list({ assetGroup, q, fixStatus, severity, page, limit, sort, order } = {}) {
    const where = {};
    if (assetGroup) where.assetGroup = assetGroup;
    if (fixStatus) where.fixStatus = fixStatus;
    if (severity) where.severity = severity;
    if (q) {
      where.OR = [
        { vulnId: { contains: q } },
        { affectedProduct: { contains: q } },
      ];
    }
    const orderBy = sort
      ? [{ [sort]: order === 'asc' ? 'asc' : 'desc' }]
      : [{ sortOrder: 'asc' }, { createdAt: 'desc' }];
    return this.findMany({ where, orderBy, page, pageSize: limit });
  }
}

export default new VulnRepository();
