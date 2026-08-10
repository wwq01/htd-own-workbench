/**
 * 项目里程碑模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';

class MilestoneRepository extends BaseRepository {
  constructor() {
    super('projectMilestone');
  }

  /**
   * 按项目 ID 查询所有里程碑
   */
  async listByProject(projectId) {
    return this.findMany({
      where: { projectId },
      orderBy: [
        { completed: 'asc' },
        { dueDate: 'asc' },
        { sortOrder: 'asc' },
      ],
    });
  }

  /**
   * 查询即将到期的里程碑（首页用）
   * @param {string} startDate YYYY-MM-DD
   * @param {string} endDate   YYYY-MM-DD
   */
  async listUpcoming(startDate, endDate) {
    return this.findMany({
      where: {
        completed: false,
        dueDate: { gte: startDate, lte: endDate },
      },
      include: {
        project: {
          select: { id: true, customerName: true, phase: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }
}

export default new MilestoneRepository();
