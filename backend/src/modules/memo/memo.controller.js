/**
 * 备忘模块 - Controller 控制层
 */
import memoService from './memo.service.js';

class MemoController {
  async list(req, res, next) {
    try {
      const list = await memoService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      const memo = await memoService.getById(req.params.id);
      res.success(memo);
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      const memo = await memoService.create(req.body);
      res.success(memo, '创建成功');
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      const memo = await memoService.update({ id: req.params.id, ...req.body });
      res.success(memo, '更新成功');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await memoService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  async listRecent(req, res, next) {
    try {
      const limit = parseInt(req.query.limit, 10) || 3;
      const list = await memoService.listRecent(limit);
      res.success(list);
    } catch (err) { next(err); }
  }
}

export default new MemoController();
