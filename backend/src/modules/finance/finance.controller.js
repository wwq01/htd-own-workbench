/**
 * 财务收支模块 - Controller 控制层
 */
import financeService from './finance.service.js';

class FinanceController {
  /**
   * GET /api/v1/finances  列表
   *  Query: type? month? category? keyword?
   */
  async list(req, res, next) {
    try {
      const list = await financeService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  /**
   * GET /api/v1/finances/:id  详情
   */
  async getById(req, res, next) {
    try {
      const record = await financeService.getById(req.params.id);
      res.success(record);
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/finances  新增
   */
  async create(req, res, next) {
    try {
      const record = await financeService.create(req.body);
      res.success(record, '创建成功');
    } catch (err) { next(err); }
  }

  /**
   * PUT /api/v1/finances/:id  编辑
   */
  async update(req, res, next) {
    try {
      const record = await financeService.update({ id: req.params.id, ...req.body });
      res.success(record, '更新成功');
    } catch (err) { next(err); }
  }

  /**
   * DELETE /api/v1/finances/:id  软删除
   */
  async remove(req, res, next) {
    try {
      await financeService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  /**
   * GET /api/v1/finances/summary?month=YYYY-MM  月度汇总
   */
  async getMonthlySummary(req, res, next) {
    try {
      const summary = await financeService.getMonthlySummary(req.query.month);
      res.success(summary);
    } catch (err) { next(err); }
  }
}

export default new FinanceController();
