/**
 * 娱乐内容模块 - Controller 控制层
 */
import entertainmentService from './entertainment.service.js';

class EntertainmentController {
  async list(req, res, next) {
    try {
      const list = await entertainmentService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      const item = await entertainmentService.getById(req.params.id);
      res.success(item);
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      const item = await entertainmentService.create(req.body);
      res.success(item, '创建成功');
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      const item = await entertainmentService.update({ id: req.params.id, ...req.body });
      res.success(item, '更新成功');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await entertainmentService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  /**
   * GET /api/v1/entertainments/recommend  随机推荐
   */
  async recommend(req, res, next) {
    try {
      const item = await entertainmentService.recommendOne();
      res.success(item);
    } catch (err) { next(err); }
  }

  /**
   * GET /api/v1/entertainments/status-stats  各状态数量
   */
  async statusStats(req, res, next) {
    try {
      const stats = await entertainmentService.getStatusStats();
      res.success(stats);
    } catch (err) { next(err); }
  }
}

export default new EntertainmentController();
