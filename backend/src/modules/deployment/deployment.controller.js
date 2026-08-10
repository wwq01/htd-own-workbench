/**
 * 部署记录模块 - Controller 控制层
 */
import deploymentService from './deployment.service.js';

class DeploymentController {
  async list(req, res, next) {
    try {
      const list = await deploymentService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      const item = await deploymentService.getById(req.params.id);
      res.success(item);
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      const item = await deploymentService.create(req.body);
      res.success(item, '创建成功');
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      const item = await deploymentService.update({ id: req.params.id, ...req.body });
      res.success(item, '更新成功');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await deploymentService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  /**
   * GET /api/v1/deployments/env-stats  各环境类型数量
   */
  async envStats(req, res, next) {
    try {
      const stats = await deploymentService.getEnvStats();
      res.success(stats);
    } catch (err) { next(err); }
  }
}

export default new DeploymentController();
