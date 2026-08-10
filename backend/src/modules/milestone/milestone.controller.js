/**
 * 项目里程碑模块 - Controller 控制层
 */
import milestoneService from './milestone.service.js';
import projectService from '../project/project.service.js';

class MilestoneController {
  /**
   * GET /api/v1/milestones?projectId=xxx
   */
  async list(req, res, next) {
    try {
      const list = await milestoneService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/milestones
   */
  async create(req, res, next) {
    try {
      const m = await milestoneService.create(req.body);
      // 创建后自动重算项目进度
      await projectService.recalcProgress(m.projectId);
      res.success(m, '创建成功');
    } catch (err) { next(err); }
  }

  /**
   * PUT /api/v1/milestones/:id
   */
  async update(req, res, next) {
    try {
      const m = await milestoneService.update({ id: req.params.id, ...req.body });
      // 更新后自动重算项目进度
      await projectService.recalcProgress(m.projectId);
      res.success(m, '更新成功');
    } catch (err) { next(err); }
  }

  /**
   * DELETE /api/v1/milestones/:id
   */
  async remove(req, res, next) {
    try {
      const m = await milestoneService.delete(req.params.id);
      if (m) {
        await projectService.recalcProgress(m.projectId);
      }
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/milestones/:id/toggle
   */
  async toggleStatus(req, res, next) {
    try {
      const m = await milestoneService.toggleStatus(req.params.id);
      await projectService.recalcProgress(m.projectId);
      res.success(m, '状态已更新');
    } catch (err) { next(err); }
  }
}

export default new MilestoneController();
