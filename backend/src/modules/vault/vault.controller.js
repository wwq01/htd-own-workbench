/**
 * 沉淀模块 - Controller 控制层
 */
import vaultService from './vault.service.js';

class VaultController {
  /**
   * GET /api/v1/vaults  列表
   *  Query: status? sourceType? tag?
   */
  async list(req, res, next) {
    try {
      const list = await vaultService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  /**
   * GET /api/v1/vaults/:id  详情
   */
  async getById(req, res, next) {
    try {
      const item = await vaultService.getById(req.params.id);
      res.success(item);
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/vaults  新增
   */
  async create(req, res, next) {
    try {
      const item = await vaultService.create(req.body);
      res.success(item, '创建成功');
    } catch (err) { next(err); }
  }

  /**
   * PUT /api/v1/vaults/:id  编辑
   */
  async update(req, res, next) {
    try {
      const item = await vaultService.update(req.params.id, req.body);
      res.success(item, '更新成功');
    } catch (err) { next(err); }
  }

  /**
   * DELETE /api/v1/vaults/:id  软删除
   */
  async delete(req, res, next) {
    try {
      await vaultService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }
}

export default new VaultController();
