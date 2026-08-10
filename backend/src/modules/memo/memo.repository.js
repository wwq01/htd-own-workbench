/**
 * 备忘模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class MemoRepository extends BaseRepository {
  constructor() {
    super('memo');
  }

  /**
   * 最近 N 条备忘（按创建时间倒序）
   */
  async listRecent(limit = 3) {
    return this.findMany({
      where: {},
      orderBy: { createdAt: 'desc' },
      page: 1,
      pageSize: limit,
    });
  }
}

export default new MemoRepository();
