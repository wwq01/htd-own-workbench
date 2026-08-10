/**
 * 凭据保险箱模块 - Controller 控制层
 */
import secretService from './secret.service.js';

class SecretController {
  async list(req, res, next) {
    try {
      const list = await secretService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      const item = await secretService.getById(req.params.id);
      res.success(item);
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      const item = await secretService.create(req.body);
      res.success(item, '创建成功');
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      const item = await secretService.update({ id: req.params.id, ...req.body });
      res.success(item, '更新成功');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await secretService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  /**
   * GET /api/v1/secrets/type-stats  各类型数量
   */
  async typeStats(req, res, next) {
    try {
      const stats = await secretService.getTypeStats();
      res.success(stats);
    } catch (err) { next(err); }
  }
}

export default new SecretController();
