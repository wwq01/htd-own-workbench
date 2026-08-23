/**
 * 应急响应记录模块 - Controller 控制层
 */
import incidentService from './incident.service.js';
import { changeIncidentStatusSchema } from './incident.schema.js';

class IncidentController {
  async list(req, res, next) {
    try {
      res.success(await incidentService.list(req.query));
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      res.success(await incidentService.getById(req.params.id));
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      res.success(await incidentService.create(req.body), '创建成功');
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      res.success(await incidentService.update({ id: req.params.id, ...req.body }), '更新成功');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await incidentService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  async changeStatus(req, res, next) {
    try {
      const body = changeIncidentStatusSchema.parse(req.body);
      res.success(await incidentService.changeStatus(req.params.id, body.status), '状态已更新');
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/incidents/:id/timeline  追加时间线条目
   */
  async addTimeline(req, res, next) {
    try {
      res.success(await incidentService.addTimeline(req.params.id, req.body), '时间线条目已追加');
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/incidents/:id/actions  追加处置动作条目
   */
  async addActions(req, res, next) {
    try {
      res.success(await incidentService.addActions(req.params.id, req.body), '处置动作已追加');
    } catch (err) { next(err); }
  }
}

export default new IncidentController();
