/**
 * 时间块模块 - Controller 控制层
 */
import timeBlockService from './time-block.service.js';

class TimeBlockController {
  /**
   * GET /api/v1/time-blocks  列表
   *  Query: type? | startedFrom? | startedTo?
   */
  async list(req, res, next) {
    try {
      const list = await timeBlockService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  /**
   * GET /api/v1/time-blocks/stats  统计聚合
   */
  async getStats(req, res, next) {
    try {
      const stats = await timeBlockService.getStats(req.query);
      res.success(stats);
    } catch (err) { next(err); }
  }

  /**
   * GET /api/v1/time-blocks/:id  详情
   */
  async getById(req, res, next) {
    try {
      const block = await timeBlockService.getById(req.params.id);
      res.success(block);
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/time-blocks  新增（补录）
   */
  async create(req, res, next) {
    try {
      const block = await timeBlockService.create(req.body);
      res.success(block, '创建成功');
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/time-blocks/start  开始时间块（番茄钟）
   */
  async start(req, res, next) {
    try {
      const block = await timeBlockService.start(req.body);
      res.success(block, '已开始');
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/time-blocks/:id/stop  结束时间块
   *  Body: { interrupted?: boolean }
   */
  async stop(req, res, next) {
    try {
      const block = await timeBlockService.stop(req.params.id, req.body);
      res.success(block, '已结束');
    } catch (err) { next(err); }
  }

  /**
   * PUT /api/v1/time-blocks/:id  编辑
   */
  async update(req, res, next) {
    try {
      const block = await timeBlockService.update(req.params.id, req.body);
      res.success(block, '更新成功');
    } catch (err) { next(err); }
  }

  /**
   * DELETE /api/v1/time-blocks/:id  软删除
   */
  async remove(req, res, next) {
    try {
      await timeBlockService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }
}

export default new TimeBlockController();
