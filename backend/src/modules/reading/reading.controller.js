/**
 * 阅读 / 资料模块 - Controller 控制层
 */
import readingService from './reading.service.js';
import { changeReadingStatusSchema } from './reading.schema.js';

class ReadingController {
  async list(req, res, next) {
    try {
      res.success(await readingService.list(req.query));
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      res.success(await readingService.getById(req.params.id));
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      res.success(await readingService.create(req.body), '创建成功');
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      res.success(await readingService.update({ id: req.params.id, ...req.body }), '更新成功');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await readingService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  async changeStatus(req, res, next) {
    try {
      const body = changeReadingStatusSchema.parse(req.body);
      res.success(await readingService.changeStatus(req.params.id, body.status), '状态已更新');
    } catch (err) { next(err); }
  }

  async convertToVault(req, res, next) {
    try {
      res.success(await readingService.convertToVault(req.params.id), '已沉淀到 Vault');
    } catch (err) { next(err); }
  }
}

export default new ReadingController();
