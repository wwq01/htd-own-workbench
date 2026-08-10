/**
 * 凭据保险箱模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class SecretRepository extends BaseRepository {
  constructor() {
    super('secret');
  }

  /**
   * 列表查询（支持类型筛选、关键字搜索）
   */
  async listWithFilters(filters = {}) {
    const where = { deletedAt: null };

    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.keyword) {
      where.OR = [
        { name: { contains: filters.keyword } },
        { usageScenario: { contains: filters.keyword } },
        { remark: { contains: filters.keyword } },
      ];
    }

    return this.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { updatedAt: 'desc' },
      ],
    });
  }

  /**
   * 统计各类型数量
   */
  async countByType() {
    const items = await this.findAll({}, { select: { type: true } });
    const map = {};
    for (const it of items) {
      map[it.type] = (map[it.type] || 0) + 1;
    }
    return map;
  }

  /**
   * 查询即将过期的凭据（7天内）
   */
  async findExpiringSoon(days = 7) {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const futureStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;

    return this.findAll({
      expiryDate: { gte: nowStr, lte: futureStr },
    }, {
      select: { id: true, name: true, type: true, expiryDate: true },
    });
  }
}

export default new SecretRepository();
