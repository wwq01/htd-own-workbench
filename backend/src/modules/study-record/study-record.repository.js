/**
 * 学习记录模块 - Repository 数据层
 */
import { BaseRepository } from '../../database/base.repository.js';
import prisma from '../../database/prisma.js';
import { formatDate, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from '../../common/utils/date.js';

class StudyRecordRepository extends BaseRepository {
  constructor() {
    super('studyRecord');
  }

  /**
   * 列表查询（支持按类型、技术方向筛选）
   */
  async listWithFilters(filters = {}) {
    const where = { deletedAt: null };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.techDirection) {
      where.techDirection = filters.techDirection;
    }

    return this.findMany({
      where,
      orderBy: [
        { studyDate: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * 统计指定日期范围的学习时长
   */
  async sumDurationByDateRange(startDate, endDate) {
    const records = await prisma.studyRecord.findMany({
      where: {
        deletedAt: null,
        studyDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { duration: true },
    });
    return records.reduce((sum, r) => sum + (r.duration || 0), 0);
  }

  /**
   * 本周学习时长
   */
  async sumWeekDuration() {
    const weekStart = formatDate(startOfWeek());
    const weekEnd = formatDate(endOfWeek());
    return this.sumDurationByDateRange(weekStart, weekEnd);
  }

  /**
   * 本月学习时长
   */
  async sumMonthDuration() {
    const monthStart = formatDate(startOfMonth());
    const monthEnd = formatDate(endOfMonth());
    return this.sumDurationByDateRange(monthStart, monthEnd);
  }
}

export default new StudyRecordRepository();
