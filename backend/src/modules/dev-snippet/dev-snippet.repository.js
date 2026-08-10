/**
 * 代码片段模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class DevSnippetRepository extends BaseRepository {
  constructor() {
    super('devSnippet');
  }

  /**
   * 列表查询（支持按分类筛选、关键字搜索）
   */
  async listWithFilters(filters = {}) {
    const where = { deletedAt: null };

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.keyword) {
      where.OR = [
        { name: { contains: filters.keyword } },
        { code: { contains: filters.keyword } },
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
   * 查询所有分类（去重）
   */
  async listCategories() {
    const snippets = await this.findAll({}, { select: { category: true } });
    const categories = [...new Set(snippets.map(s => s.category))];
    return categories.filter(Boolean);
  }
}

export default new DevSnippetRepository();
