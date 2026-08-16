/**
 * 会议模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class MeetingRepository extends BaseRepository {
  constructor() {
    super('meeting');
  }

  /**
   * 按筛选条件查询会议列表
   * @param {object} filter { relatedProjectId?, heldAtFrom? (ISO), heldAtTo? (ISO), keyword? }
   */
  async listByFilter(filter = {}) {
    const where = {};

    if (filter.relatedProjectId) {
      where.relatedProjectId = filter.relatedProjectId;
    }

    if (filter.keyword) {
      // SQLite 的 contains(LIKE) 对 ASCII 默认大小写不敏感，无需 mode 参数
      where.title = { contains: filter.keyword };
    }

    if (filter.heldAtFrom || filter.heldAtTo) {
      where.heldAt = {};
      if (filter.heldAtFrom) {
        where.heldAt.gte = new Date(`${filter.heldAtFrom}T00:00:00.000Z`);
      }
      if (filter.heldAtTo) {
        where.heldAt.lte = new Date(`${filter.heldAtTo}T23:59:59.999Z`);
      }
    }

    return this.findMany({
      where,
      orderBy: { heldAt: 'desc' },
    });
  }
}

export default new MeetingRepository();
