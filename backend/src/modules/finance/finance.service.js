/**
 * 财务收支模块 - Service 服务层
 */
import financeRepository from './finance.repository.js';
import {
  createFinanceSchema,
  updateFinanceSchema,
  listFinanceSchema,
  financeIdSchema,
  monthSchema,
} from './finance.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';

/**
 * 金额保留两位小数
 */
function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * 将 'YYYY-MM' 转换为日期范围 [月初, 下月初)
 * 等价于 Prisma 中 date startsWith 'YYYY-MM-'（DateTime 字段不支持 startsWith，故用范围）
 */
function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const nextMonthStart = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  return { monthStart, nextMonthStart };
}

class FinanceService {
  /**
   * 列表查询：按类型 / 月份 / 分类 / 关键字筛选，按日期倒序
   */
  async list(query = {}) {
    const q = listFinanceSchema.parse(query);
    const where = {};
    if (q.type) where.type = q.type;
    if (q.category) where.category = q.category;
    if (q.keyword) where.remark = { contains: q.keyword };
    if (q.month) {
      const { monthStart, nextMonthStart } = monthRange(q.month);
      // 等价于 date: { startsWith: month + '-' }
      where.date = { gte: monthStart, lt: nextMonthStart };
    }
    return financeRepository.findMany({ where, orderBy: { date: 'desc' } });
  }

  /**
   * 根据 ID 获取详情
   */
  async getById(id) {
    financeIdSchema.parse({ id });
    const record = await financeRepository.findById(id);
    if (!record) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '收支记录不存在');
    }
    return record;
  }

  /**
   * 新增收支记录
   */
  async create(payload) {
    const data = createFinanceSchema.parse(payload);
    return financeRepository.create({
      date: new Date(data.date),
      type: data.type,
      amount: round2(data.amount),
      category: data.category,
      subCategory: data.subCategory || null,
      tags: JSON.stringify(data.tags || []),
      remark: data.remark || null,
    });
  }

  /**
   * 编辑收支记录（部分字段更新）
   */
  async update(idOrPayload, payload) {
    let id;
    let fields;
    if (typeof idOrPayload === 'object' && idOrPayload !== null) {
      ({ id, ...fields } = idOrPayload);
    } else {
      id = idOrPayload;
      fields = payload || {};
    }
    const parsed = updateFinanceSchema.parse({ id, ...fields });
    const { id: pid, ...valid } = parsed;
    const exists = await financeRepository.findById(pid);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '收支记录不存在');
    }

    const updateData = {};
    if (valid.date !== undefined) updateData.date = new Date(valid.date);
    if (valid.type !== undefined) updateData.type = valid.type;
    if (valid.amount !== undefined) updateData.amount = round2(valid.amount);
    if (valid.category !== undefined) updateData.category = valid.category;
    if ('subCategory' in valid) updateData.subCategory = valid.subCategory || null;
    if (valid.tags !== undefined) updateData.tags = JSON.stringify(valid.tags || []);
    if ('remark' in valid) updateData.remark = valid.remark || null;

    return financeRepository.updateById(pid, updateData);
  }

  /**
   * 软删除收支记录
   */
  async delete(id) {
    financeIdSchema.parse({ id });
    const exists = await financeRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '收支记录不存在');
    }
    return financeRepository.softDeleteById(id);
  }

  /**
   * 月度汇总：收入 / 支出 / 净流入
   */
  async getMonthlySummary(month) {
    const { month: m } = monthSchema.parse({ month });
    const { monthStart, nextMonthStart } = monthRange(m);
    const income = round2(await financeRepository.sumByTypeAndMonth('INCOME', monthStart, nextMonthStart));
    const expense = round2(await financeRepository.sumByTypeAndMonth('EXPENSE', monthStart, nextMonthStart));
    const net = round2(income - expense);
    return { month: m, income, expense, net };
  }
}

export default new FinanceService();
