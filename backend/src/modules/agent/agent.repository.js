/**
 * 本地 Agent 通道 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class AgentTaskRepository extends BaseRepository {
  constructor() {
    super('agentTask');
  }
}

export default new AgentTaskRepository();
