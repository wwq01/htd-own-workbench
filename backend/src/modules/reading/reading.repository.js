/**
 * 阅读 / 资料模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class ReadingRepository extends BaseRepository {
  constructor() {
    super('readingMaterial');
  }

  async list({ q, type, readingStatus, tags, page, limit, sort, order } = {}) {
    const where = {};
    if (type) where.type = type;
    if (readingStatus) where.readingStatus = readingStatus;
    // tags 以 JSON 字符串存储，contains 做子串匹配
    if (tags) where.tags = { contains: tags };
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { notes: { contains: q } },
        { sourceUrl: { contains: q } },
      ];
    }
    const orderBy = sort
      ? [{ [sort]: order === 'asc' ? 'asc' : 'desc' }]
      : [{ sortOrder: 'asc' }, { createdAt: 'desc' }];
    return this.findMany({ where, orderBy, page, pageSize: limit });
  }
}

export default new ReadingRepository();
