/**
 * 本地 Agent 通道 - Controller 控制层
 */
import agentService from './agent.service.js';

class AgentController {
  async list(req, res, next) {
    try {
      res.success(await agentService.list(req.query));
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      res.success(await agentService.create(req.body), '已提交并执行');
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      res.success(await agentService.getById(req.params.id));
    } catch (err) { next(err); }
  }

  async runNow(req, res, next) {
    try {
      res.success(await agentService.runNow(req.params.id), '已重新执行');
    } catch (err) { next(err); }
  }

  async cancel(req, res, next) {
    try {
      res.success(await agentService.cancel(req.params.id), '已取消');
    } catch (err) { next(err); }
  }

  async queue(req, res, next) {
    try {
      res.success(await agentService.queueStats());
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await agentService.remove(req.params.id);
      res.success(null, '已删除');
    } catch (err) { next(err); }
  }

  async skills(req, res, next) {
    try {
      res.success(await agentService.listSkills());
    } catch (err) { next(err); }
  }
}

export default new AgentController();
