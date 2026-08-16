/**
 * 待办模块 - Controller 控制层
 */
import todoService from './todo.service.js';

class TodoController {
  /**
   * GET /api/v1/todos  列表
   *  Query: todoDate? | startDate?&endDate?  category? status? priority?
   */
  async list(req, res, next) {
    try {
      const list = await todoService.list(req.query);
      res.success(list);
    } catch (err) { next(err); }
  }

  /**
   * GET /api/v1/todos/:id  详情
   */
  async getById(req, res, next) {
    try {
      const todo = await todoService.getById(req.params.id);
      res.success(todo);
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/todos  新增
   */
  async create(req, res, next) {
    try {
      const todo = await todoService.create(req.body);
      res.success(todo, '创建成功');
    } catch (err) { next(err); }
  }

  /**
   * PUT /api/v1/todos/:id  编辑
   */
  async update(req, res, next) {
    try {
      const todo = await todoService.update({ id: req.params.id, ...req.body });
      res.success(todo, '更新成功');
    } catch (err) { next(err); }
  }

  /**
   * DELETE /api/v1/todos/:id  软删除
   */
  async remove(req, res, next) {
    try {
      await todoService.delete(req.params.id);
      res.success(null, '删除成功');
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/todos/:id/toggle  切换完成状态
   */
  async toggleStatus(req, res, next) {
    try {
      const todo = await todoService.toggleStatus(req.params.id);
      res.success(todo, '状态已更新');
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/todos/:id/delay  延期（§6.2.1 任务 5 态）
   * body: { toDate? } 不传默认延期到明天
   */
  async delay(req, res, next) {
    try {
      const todo = await todoService.delayTodo(req.params.id, req.body || {});
      res.success(todo, '已延期');
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/todos/:id/status  通用状态切换（受 5 态状态机约束）
   * body: { status }
   */
  async changeStatus(req, res, next) {
    try {
      const todo = await todoService.changeStatus(req.params.id, (req.body || {}).status);
      res.success(todo, '状态已更新');
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/todos/migrate/today-to-tomorrow  今日未完成→明日
   */
  async migrateTodayToTomorrow(req, res, next) {
    try {
      const r = await todoService.migrateTodayPendingToTomorrow();
      res.success(r, `已迁移 ${r.movedCount} 条到明日`);
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/todos/migrate/tomorrow-to-today  明日所有→今日
   */
  async migrateTomorrowToToday(req, res, next) {
    try {
      const r = await todoService.migrateAllTomorrowToToday();
      res.success(r, `已迁移 ${r.movedCount} 条到今日`);
    } catch (err) { next(err); }
  }

  /**
   * POST /api/v1/todos/migrate  自定义日期迁移（ids? fromDate toDate）
   */
  async migrateCustom(req, res, next) {
    try {
      const r = await todoService.migratePendingToDate(req.body);
      res.success(r, `已迁移 ${r.movedCount} 条`);
    } catch (err) { next(err); }
  }
}

export default new TodoController();
