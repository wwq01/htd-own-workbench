/**
 * 项目模块 - Controller 控制层
 */
import projectService from './project.service.js';

class ProjectController {
  /**
   * GET /api/v1/projects  列表（带筛选）
   *  Query: phase? priority? securityDomain? keyword?
   */
  async list(req, res, next) {
    try {
      const list = await projectService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  /**
   * GET /api/v1/projects/:id  详情（含里程碑 + 任务）
   */
  async getById(req, res, next) {
    try {
      const project = await projectService.getDetailById(req.params.id);
      res.success(project);
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/projects  新增
   */
  async create(req, res, next) {
    try {
      const project = await projectService.create(req.body);
      res.success(project, '创建成功');
    } catch (err) { next(err); }
  }

  /**
   * PUT /api/v1/projects/:id  编辑
   */
  async update(req, res, next) {
    try {
      const project = await projectService.update({ id: req.params.id, ...req.body });
      res.success(project, '更新成功');
    } catch (err) { next(err); }
  }

  /**
   * PATCH /api/v1/projects/:id/memo  仅更新项目备忘（失焦自动保存）
   */
  async updateMemo(req, res, next) {
    try {
      const project = await projectService.updateMemo(req.params.id, req.body.projectMemo);
      res.success(project, '备忘已保存');
    } catch (err) { next(err); }
  }

  /**
   * DELETE /api/v1/projects/:id  软删除（级联软删里程碑与任务）
   */
  async remove(req, res, next) {
    try {
      await projectService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/projects/:id/generate-review  一键生成项目复盘
   */
  async generateReview(req, res, next) {
    try {
      const result = await projectService.generateReview(req.params.id);
      res.success(result, result.created ? '复盘草稿已生成' : '已存在复盘草稿');
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/projects/:id/phase  项目阶段切换（受 6 阶段状态机约束）
   * body: { phase, reason? }
   */
  async changePhase(req, res, next) {
    try {
      const result = await projectService.changePhase(req.params.id, (req.body || {}).phase, (req.body || {}).reason);
      res.success(result, '阶段已更新');
    } catch (err) { next(err); }
  }
}

export default new ProjectController();
