/**
 * S2-4 双轨笔记模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class NoteRepository extends BaseRepository {
  constructor() {
    super('note');
  }
}

export default new NoteRepository();
