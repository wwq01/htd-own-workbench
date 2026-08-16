/**
 * 习惯打卡模块 - Controller 控制层
 */
import habitService from './habit.service.js';

class HabitController {
  /**
   * GET /api/v1/habits  习惯列表
   */
  async listHabits(req, res, next) {
    try {
      const list = await habitService.listHabits();
      res.success(list);
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/habits  新增习惯
   */
  async createHabit(req, res, next) {
    try {
      const habit = await habitService.createHabit(req.body);
      res.success(habit, '创建成功');
    } catch (err) { next(err); }
  }

  /**
   * PUT /api/v1/habits/:id  编辑习惯
   */
  async updateHabit(req, res, next) {
    try {
      const habit = await habitService.updateHabit(req.params.id, req.body);
      res.success(habit, '更新成功');
    } catch (err) { next(err); }
  }

  /**
   * DELETE /api/v1/habits/:id  删除习惯
   */
  async deleteHabit(req, res, next) {
    try {
      await habitService.deleteHabit(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/habits/:id/checkin  打卡
   *  Body: { date, count?, note? }
   */
  async checkIn(req, res, next) {
    try {
      const { date, count, note } = req.body || {};
      const result = await habitService.checkIn(req.params.id, date, count, note);
      res.success(result, '打卡成功');
    } catch (err) { next(err); }
  }

  /**
   * GET /api/v1/habits/:id/checkins  某月打卡记录
   *  Query: month=YYYY-MM
   */
  async listCheckIns(req, res, next) {
    try {
      const { month } = req.query;
      const list = await habitService.listCheckIns(req.params.id, month);
      res.success(list);
    } catch (err) { next(err); }
  }

  /**
   * GET /api/v1/habits/:id/stats  连续打卡统计
   */
  async getStats(req, res, next) {
    try {
      const stats = await habitService.getStats(req.params.id);
      res.success(stats);
    } catch (err) { next(err); }
  }
}

export default new HabitController();
