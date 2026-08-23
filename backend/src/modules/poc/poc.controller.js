/**
 * POC 跟踪模块 - Controller 控制层
 */
import pocService from './poc.service.js';
import { changePocStatusSchema } from './poc.schema.js';

class PocController {
  async list(req, res, next) {
    try {
      res.success(await pocService.list(req.query));
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      res.success(await pocService.getById(req.params.id));
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      res.success(await pocService.create(req.body), '创建成功');
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      res.success(await pocService.update({ id: req.params.id, ...req.body }), '更新成功');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await pocService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  async changeStatus(req, res, next) {
    try {
      const body = changePocStatusSchema.parse(req.body);
      res.success(await pocService.changeStatus(req.params.id, body.status), '状态已更新');
    } catch (err) { next(err); }
  }
}

export default new PocController();
