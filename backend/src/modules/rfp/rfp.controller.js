/**
 * S2-5 RFP 条目级应答模块 - Controller 控制层
 */
import rfpItemService from './rfp.service.js';
import { changeRfpItemStatusSchema } from './rfp.schema.js';

class RfpItemController {
  async list(req, res, next) {
    try {
      res.success(await rfpItemService.list(req.query));
    } catch (err) { next(err); }
  }

  async stats(req, res, next) {
    try {
      res.success(await rfpItemService.stats(req.query.bidId));
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      res.success(await rfpItemService.getById(req.params.id));
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      res.success(await rfpItemService.create(req.body), 'RFP 条目已创建');
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      res.success(await rfpItemService.update(req.params.id, req.body), 'RFP 条目已更新');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await rfpItemService.delete(req.params.id);
      res.success(null, 'RFP 条目已删除');
    } catch (err) { next(err); }
  }

  async changeStatus(req, res, next) {
    try {
      const body = changeRfpItemStatusSchema.parse(req.body);
      res.success(await rfpItemService.changeStatus(req.params.id, body.status), '应答状态已更新');
    } catch (err) { next(err); }
  }
}

export default new RfpItemController();
