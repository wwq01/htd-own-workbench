/**
 * 合同回款模块 - Controller 控制层
 */
import contractService from './finance-contract.service.js';

class ContractReceivableController {
  /**
   * GET /api/v1/finance-contracts  列表
   *  Query: keyword? clientName?
   */
  async list(req, res, next) {
    try {
      const list = await contractService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  /**
   * GET /api/v1/finance-contracts/:id  详情
   */
  async getById(req, res, next) {
    try {
      const contract = await contractService.getById(req.params.id);
      res.success(contract);
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/finance-contracts  新增
   */
  async create(req, res, next) {
    try {
      const contract = await contractService.create(req.body);
      res.success(contract, '创建成功');
    } catch (err) { next(err); }
  }

  /**
   * PUT /api/v1/finance-contracts/:id  编辑
   */
  async update(req, res, next) {
    try {
      const contract = await contractService.update({ id: req.params.id, ...req.body });
      res.success(contract, '更新成功');
    } catch (err) { next(err); }
  }

  /**
   * DELETE /api/v1/finance-contracts/:id  软删除
   */
  async remove(req, res, next) {
    try {
      await contractService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/finance-contracts/:id/nodes/:nodeIndex  更新节点回款
   *  Body: { receivedAmount, receivedAt? }
   */
  async updateNode(req, res, next) {
    try {
      const contract = await contractService.updateNode(
        req.params.id,
        Number(req.params.nodeIndex),
        req.body.receivedAmount,
        req.body.receivedAt,
      );
      res.success(contract, '回款已更新');
    } catch (err) { next(err); }
  }
}

export default new ContractReceivableController();
