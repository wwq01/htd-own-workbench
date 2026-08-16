/**
 * 合同回款模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class ContractReceivableRepository extends BaseRepository {
  constructor() {
    super('contractReceivable');
  }
}

export default new ContractReceivableRepository();
