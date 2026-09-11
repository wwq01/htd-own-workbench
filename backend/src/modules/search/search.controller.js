/**
 * 全文搜索模块 - Controller 控制层
 */
import searchService from './search.service.js';
import { searchSchema } from './search.schema.js';

class SearchController {
  async search(req, res, next) {
    try {
      const { q, modules, limit } = searchSchema.parse(req.query);
      res.success(await searchService.search({ q, modules, limit }));
    } catch (err) { next(err); }
  }
}

export default new SearchController();
