/**
 * 娱乐内容模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class EntertainmentRepository extends BaseRepository {
  constructor() {
    super('entertainment');
  }

  /**
   * 列表查询（支持类型/状态筛选、关键字搜索）
   */
  async listWithFilters(filters = {}) {
    const where = { deletedAt: null };

    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.keyword) {
      where.OR = [
        { name: { contains: filters.keyword } },
        { progress: { contains: filters.keyword } },
        { review: { contains: filters.keyword } },
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
   * 统计各状态数量
   */
  async countByStatus() {
    const items = await this.findAll({}, { select: { status: true } });
    const map = {};
    for (const it of items) {
      map[it.status] = (map[it.status] || 0) + 1;
    }
    return map;
  }

  /**
   * 随机获取一条「想看/在玩」状态的作品（用于今日轮播）
   */
  async pickRandomActive() {
    const wantItems = await this.findAll({ status: '想看' });
    const playingItems = await this.findAll({ status: '在玩' });
    const pool = [...playingItems, ...wantItems];
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}

export default new EntertainmentRepository();
