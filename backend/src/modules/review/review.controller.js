/**
 * 复盘模块 - Controller 控制层
 */
import reviewService from './review.service.js';

class ReviewController {
  async list(req, res, next) {
    try {
      const list = await reviewService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      const review = await reviewService.getById(req.params.id);
      res.success(review);
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      const review = await reviewService.create(req.body);
      res.success(review, '创建成功');
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      const review = await reviewService.update({ id: req.params.id, ...req.body });
      res.success(review, '更新成功');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await reviewService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/reviews/current-week  创建本周周复盘（含自动统计）
   */
  async createCurrentWeek(req, res, next) {
    try {
      const result = await reviewService.createCurrentWeek(req.body || {});
      res.success(result, result.created ? '本周周复盘已创建' : '本周周复盘已存在');
    } catch (err) { next(err); }
  }
}

export default new ReviewController();
