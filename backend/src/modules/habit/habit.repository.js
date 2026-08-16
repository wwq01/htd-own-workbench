/**
 * 习惯打卡模块 - Repository 数据层
 * 习惯本体存 habit 表；打卡明细存 habitCheckIn 表（独立模型）。
 */
import { BaseRepository } from '../../database/base.repository.js';
import prisma from '../../database/prisma.js';

class HabitRepository extends BaseRepository {
  constructor() {
    super('habit');
  }

  /**
   * 查询指定习惯在某日的打卡记录（不含软删除）
   */
  async findCheckIn(habitId, date) {
    return prisma.habitCheckIn.findFirst({ where: { habitId, date, deletedAt: null } });
  }

  /**
   * 新增一条打卡明细（habitCheckIn 表）
   */
  async createCheckIn(data) {
    return prisma.habitCheckIn.create({ data });
  }

  /**
   * 按 id 更新一条打卡明细
   */
  async updateCheckInById(id, data) {
    return prisma.habitCheckIn.update({ where: { id }, data });
  }

  /**
   * 查询某习惯的打卡明细（可带过滤 + 排序）
   */
  async findManyCheckIns(where, orderBy) {
    return prisma.habitCheckIn.findMany({ where: { ...where, deletedAt: null }, orderBy });
  }
}

export default new HabitRepository();
