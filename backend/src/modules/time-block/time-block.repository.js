/**
 * 时间块模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class TimeBlockRepository extends BaseRepository {
  constructor() {
    super('timeBlock');
  }
}

export default new TimeBlockRepository();
