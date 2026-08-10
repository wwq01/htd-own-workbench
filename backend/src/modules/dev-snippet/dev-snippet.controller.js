/**
 * 代码片段模块 - Controller 控制层
 */
import devSnippetService from './dev-snippet.service.js';

class DevSnippetController {
  async list(req, res, next) {
    try {
      const list = await devSnippetService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  async getCategories(req, res, next) {
    try {
      const categories = await devSnippetService.listCategories();
      res.success(categories);
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      const snippet = await devSnippetService.getById(req.params.id);
      res.success(snippet);
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      const snippet = await devSnippetService.create(req.body);
      res.success(snippet, '创建成功');
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      const snippet = await devSnippetService.update({ id: req.params.id, ...req.body });
      res.success(snippet, '更新成功');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await devSnippetService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }
}

export default new DevSnippetController();
