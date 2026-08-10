/**
 * 学习记录模块 - Controller 控制层
 */
import studyRecordService from './study-record.service.js';

class StudyRecordController {
  async list(req, res, next) {
    try {
      const list = await studyRecordService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  async getStats(req, res, next) {
    try {
      const stats = await studyRecordService.getDurationStats();
      res.success(stats);
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      const record = await studyRecordService.getById(req.params.id);
      res.success(record);
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      const record = await studyRecordService.create(req.body);
      res.success(record, '创建成功');
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      const record = await studyRecordService.update({ id: req.params.id, ...req.body });
      res.success(record, '更新成功');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await studyRecordService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }
}

export default new StudyRecordController();
