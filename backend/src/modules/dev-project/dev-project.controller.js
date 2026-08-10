/**
 * 开发项目模块 - Controller 控制层
 */
import devProjectService from './dev-project.service.js';

class DevProjectController {
  async list(req, res, next) {
    try {
      const list = await devProjectService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      const project = await devProjectService.getById(req.params.id);
      res.success(project);
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      const project = await devProjectService.create(req.body);
      res.success(project, '创建成功');
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      const project = await devProjectService.update({ id: req.params.id, ...req.body });
      res.success(project, '更新成功');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await devProjectService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }
}

export default new DevProjectController();
