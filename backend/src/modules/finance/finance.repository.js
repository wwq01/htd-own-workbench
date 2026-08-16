/**
 * 财务收支模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class FinanceRepository extends BaseRepository {
  constructor() {
    super('financeRecord');
  }

  /**
   * 按月聚合某类型的金额总和
   * 使用日期范围 [月初, 下月初) 等价于 date startsWith 'YYYY-MM-'
   */
  async sumByTypeAndMonth(type, monthStart, nextMonthStart) {
    const result = await this.model.aggregate({
      _sum: { amount: true },
      where: {
        type,
        deletedAt: null,
        date: { gte: monthStart, lt: nextMonthStart },
      },
    });
    return result._sum.amount || 0;
  }
}

export default new FinanceRepository();
