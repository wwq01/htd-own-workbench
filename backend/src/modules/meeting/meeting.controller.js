/**
 * 会议模块 - Controller 控制层
 */
import meetingService from './meeting.service.js';

class MeetingController {
  /**
   * GET /api/v1/meetings  列表
   *  Query: relatedProjectId? heldAtFrom? heldAtTo? keyword?
   */
  async list(req, res, next) {
    try {
      const list = await meetingService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  /**
   * GET /api/v1/meetings/:id  详情
   */
  async getById(req, res, next) {
    try {
      const meeting = await meetingService.getById(req.params.id);
      res.success(meeting);
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/meetings  新增
   */
  async create(req, res, next) {
    try {
      const meeting = await meetingService.create(req.body);
      res.success(meeting, '创建成功');
    } catch (err) { next(err); }
  }

  /**
   * PUT /api/v1/meetings/:id  编辑
   */
  async update(req, res, next) {
    try {
      const meeting = await meetingService.update({ id: req.params.id, ...req.body });
      res.success(meeting, '更新成功');
    } catch (err) { next(err); }
  }

  /**
   * DELETE /api/v1/meetings/:id  软删除
   */
  async remove(req, res, next) {
    try {
      await meetingService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/meetings/:id/generate-review  生成复盘草稿
   */
  async generateReview(req, res, next) {
    try {
      const review = await meetingService.generateReview(req.params.id);
      res.success(review, '已生成复盘草稿');
    } catch (err) { next(err); }
  }
}

export default new MeetingController();
