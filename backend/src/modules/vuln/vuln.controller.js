/**
 * 漏洞跟踪库模块 - Controller 控制层
 */
import vulnService from './vuln.service.js';
import { changeVulnStatusSchema } from './vuln.schema.js';

class VulnController {
  async list(req, res, next) {
    try {
      res.success(await vulnService.list(req.query));
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      res.success(await vulnService.getById(req.params.id));
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      res.success(await vulnService.create(req.body), '创建成功');
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      res.success(await vulnService.update({ id: req.params.id, ...req.body }), '更新成功');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await vulnService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  async changeStatus(req, res, next) {
    try {
      const body = changeVulnStatusSchema.parse(req.body);
      res.success(await vulnService.changeStatus(req.params.id, body.status), '状态已更新');
    } catch (err) { next(err); }
  }
}

export default new VulnController();
