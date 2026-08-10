/**
 * 开发问题模块 - Controller 控制层
 */
import devIssueService from './dev-issue.service.js';

class DevIssueController {
  async list(req, res, next) {
    try {
      const list = await devIssueService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      const issue = await devIssueService.getById(req.params.id);
      res.success(issue);
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      const issue = await devIssueService.create(req.body);
      res.success(issue, '创建成功');
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      const issue = await devIssueService.update({ id: req.params.id, ...req.body });
      res.success(issue, '更新成功');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await devIssueService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }
}

export default new DevIssueController();
