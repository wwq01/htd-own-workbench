/**
 * 待学清单模块 - Controller 控制层
 */
import studyPendingService from './study-pending.service.js';

class StudyPendingController {
  async list(req, res, next) {
    try {
      const list = await studyPendingService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      const item = await studyPendingService.getById(req.params.id);
      res.success(item);
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      const item = await studyPendingService.create(req.body);
      res.success(item, '创建成功');
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      const item = await studyPendingService.update({ id: req.params.id, ...req.body });
      res.success(item, '更新成功');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await studyPendingService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/study-pendings/:id/complete
   * 标记已学习，自动转为学习记录
   */
  async complete(req, res, next) {
    try {
      const result = await studyPendingService.completeAndConvert({
        id: req.params.id,
        ...req.body,
      });
      res.success(result, '已标记为已学习并创建学习记录');
    } catch (err) { next(err); }
  }
}

export default new StudyPendingController();
