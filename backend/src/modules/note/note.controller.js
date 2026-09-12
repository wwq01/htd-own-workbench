/**
 * S2-4 双轨笔记模块 - Controller 控制层
 */
import noteService from './note.service.js';

class NoteController {
  /**
   * GET /api/v1/notes  列表
   *  Query: sourceType? sourceId? tag?
   */
  async list(req, res, next) {
    try {
      const list = await noteService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  /**
   * GET /api/v1/notes/:id  详情
   */
  async getById(req, res, next) {
    try {
      const item = await noteService.getById(req.params.id);
      res.success(item);
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/notes  新增
   */
  async create(req, res, next) {
    try {
      const item = await noteService.create(req.body);
      res.success(item, '笔记已创建');
    } catch (err) { next(err); }
  }

  /**
   * PUT /api/v1/notes/:id  编辑
   */
  async update(req, res, next) {
    try {
      const item = await noteService.update(req.params.id, req.body);
      res.success(item, '笔记已更新');
    } catch (err) { next(err); }
  }

  /**
   * DELETE /api/v1/notes/:id  软删除
   */
  async delete(req, res, next) {
    try {
      await noteService.delete(req.params.id);
      res.success(null, '笔记已删除');
    } catch (err) { next(err); }
  }
}

export default new NoteController();
