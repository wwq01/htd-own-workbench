/**
 * 沉淀模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class VaultRepository extends BaseRepository {
  constructor() {
    super('vaultItem');
  }
}

export default new VaultRepository();
