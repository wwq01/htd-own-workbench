/**
 * 项目任务模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class TaskRepository extends BaseRepository {
  constructor() {
    super('projectTask');
  }

  /**
   * 按项目 ID 查询所有任务
   */
  async listByProject(projectId) {
    return this.findMany({
      where: { projectId },
      orderBy: [
        { completed: 'asc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }
}

export default new TaskRepository();
