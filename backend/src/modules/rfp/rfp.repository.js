/**
 * S2-5 RFP 条目级应答模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class RfpItemRepository extends BaseRepository {
  constructor() {
    super('rfpItem');
  }

  /**
   * 列表查询：按投标 / 状态 / 应答类型筛选 + 关键字 + 排序
   * 默认按 sortOrder 升序、编号兜底，保证条目顺序与标书一致
   */
  async list({ bidId, q, status, responseType, sort, order, page, limit } = {}) {
    const where = {};
    if (bidId) where.bidId = bidId;
    if (status) where.status = status;
    if (responseType) where.responseType = responseType;
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { requirement: { contains: q } },
        { response: { contains: q } },
        { code: { contains: q } },
      ];
    }
    const orderBy = sort
      ? [{ [sort]: order === 'asc' ? 'asc' : 'desc' }]
      : [{ sortOrder: 'asc' }, { createdAt: 'asc' }];
    return this.findMany({ where, orderBy, page, pageSize: limit });
  }
}

export default new RfpItemRepository();
