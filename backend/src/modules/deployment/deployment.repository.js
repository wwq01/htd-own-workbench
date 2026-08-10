/**
 * 部署记录模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class DeploymentRepository extends BaseRepository {
  constructor() {
    super('deployment');
  }

  /**
   * 列表查询（支持环境类型筛选、关键字搜索）
   */
  async listWithFilters(filters = {}) {
    const where = { deletedAt: null };

    if (filters.envType) {
      where.envType = filters.envType;
    }
    if (filters.keyword) {
      where.OR = [
        { name: { contains: filters.keyword } },
        { deviceType: { contains: filters.keyword } },
        { ipAddress: { contains: filters.keyword } },
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
   * 统计各环境类型数量
   */
  async countByEnvType() {
    const items = await this.findAll({}, { select: { envType: true } });
    const map = {};
    for (const it of items) {
      map[it.envType] = (map[it.envType] || 0) + 1;
    }
    return map;
  }
}

export default new DeploymentRepository();
