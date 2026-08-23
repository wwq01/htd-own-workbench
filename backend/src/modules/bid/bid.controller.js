/**
 * 投标档案模块 - Controller 控制层
 */
import bidService from './bid.service.js';
import { changeBidStatusSchema } from './bid.schema.js';

class BidController {
  async list(req, res, next) {
    try {
      res.success(await bidService.list(req.query));
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      res.success(await bidService.getById(req.params.id));
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      res.success(await bidService.create(req.body), '创建成功');
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      res.success(await bidService.update({ id: req.params.id, ...req.body }), '更新成功');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await bidService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  async changeStatus(req, res, next) {
    try {
      const body = changeBidStatusSchema.parse(req.body);
      res.success(await bidService.changeStatus(req.params.id, body.status), '状态已更新');
    } catch (err) { next(err); }
  }
}

export default new BidController();
