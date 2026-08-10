/**
 * 项目任务模块 - Controller 控制层
 */
import taskService from './task.service.js';
import projectService from '../project/project.service.js';

class TaskController {
  /**
   * GET /api/v1/tasks?projectId=xxx
   */
  async list(req, res, next) {
    try {
      const list = await taskService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/tasks
   */
  async create(req, res, next) {
    try {
      const t = await taskService.create(req.body);
      await projectService.recalcProgress(t.projectId);
      res.success(t, '创建成功');
    } catch (err) { next(err); }
  }

  /**
   * PUT /api/v1/tasks/:id
   */
  async update(req, res, next) {
    try {
      const t = await taskService.update({ id: req.params.id, ...req.body });
      await projectService.recalcProgress(t.projectId);
      res.success(t, '更新成功');
    } catch (err) { next(err); }
  }

  /**
   * DELETE /api/v1/tasks/:id
   */
  async remove(req, res, next) {
    try {
      const t = await taskService.delete(req.params.id);
      if (t) {
        await projectService.recalcProgress(t.projectId);
      }
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/tasks/:id/toggle
   */
  async toggleStatus(req, res, next) {
    try {
      const t = await taskService.toggleStatus(req.params.id);
      await projectService.recalcProgress(t.projectId);
      res.success(t, '状态已更新');
    } catch (err) { next(err); }
  }
}

export default new TaskController();
