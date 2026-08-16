/**
 * 习惯打卡模块 - Service 服务层
 */
import habitRepository from './habit.repository.js';
import {
  createHabitSchema,
  updateHabitSchema,
  habitIdSchema,
  checkInSchema,
} from './habit.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { today } from '../../common/utils/date.js';

class HabitService {
  /**
   * 习惯列表（按创建时间升序）
   */
  async listHabits() {
    return habitRepository.findMany({
      where: {},
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 新增习惯
   */
  async createHabit(payload) {
    const data = createHabitSchema.parse(payload);
    if (!data.name || !data.name.trim()) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, '习惯名称不能为空');
    }
    if (data.frequency === 'WEEKLY' && (!data.weeklyTargetDays || data.weeklyTargetDays < 1)) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, '周习惯必须设置每周目标天数且 >= 1');
    }
    return habitRepository.create({
      name: data.name,
      frequency: data.frequency,
      dailyTargetCount: data.dailyTargetCount ?? 1,
      weeklyTargetDays: data.frequency === 'WEEKLY' ? (data.weeklyTargetDays ?? 1) : null,
      icon: data.icon || null,
      remark: data.remark || null,
    });
  }

  /**
   * 编辑习惯（部分字段更新）
   */
  async updateHabit(id, payload) {
    const parsed = updateHabitSchema.parse({ id, ...payload });
    const { id: hid, ...fields } = parsed;
    const exists = await habitRepository.findById(hid);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '习惯不存在');
    }

    const updateData = { ...fields };
    // 空字符串处理为 null
    if ('icon' in updateData && updateData.icon === '') updateData.icon = null;
    if ('remark' in updateData && updateData.remark === '') updateData.remark = null;

    // 频率切换时维护 weeklyTargetDays
    const nextFrequency = updateData.frequency || exists.frequency;
    if (nextFrequency === 'WEEKLY') {
      if (updateData.weeklyTargetDays === undefined) {
        // 未传则沿用原值（保持合法 >=1）
        updateData.weeklyTargetDays = exists.weeklyTargetDays ?? 1;
      }
    } else {
      updateData.weeklyTargetDays = null;
    }

    return habitRepository.updateById(hid, updateData);
  }

  /**
   * 软删除习惯
   */
  async deleteHabit(id) {
    habitIdSchema.parse({ id });
    const exists = await habitRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '习惯不存在');
    }
    return habitRepository.softDeleteById(id);
  }

  /**
   * 打卡（按 习惯 + 日期 幂等累加）
   * @returns 打卡记录
   */
  async checkIn(habitId, date, count = 1, note) {
    checkInSchema.parse({ habitId, date, count, note });
    const exists = await habitRepository.findCheckIn(habitId, date);
    if (exists) {
      return habitRepository.updateCheckInById(exists.id, {
        count: exists.count + count,
        note: note !== undefined ? note : exists.note,
      });
    }
    return habitRepository.createCheckIn({
      habitId,
      date,
      count,
      note: note || null,
    });
  }

  /**
   * 查询某月打卡记录
   * @param {string} habitId
   * @param {string} month  YYYY-MM
   */
  async listCheckIns(habitId, month) {
    return habitRepository.findManyCheckIns(
      {
        habitId,
        date: { startsWith: `${month}-` },
      },
      { date: 'asc' },
    );
  }

  /**
   * 统计连续打卡天数
   * @returns { currentStreak, longestStreak }
   */
  async getStats(habitId) {
    habitIdSchema.parse({ id: habitId });
    const habit = await habitRepository.findById(habitId);
    if (!habit) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '习惯不存在');
    }
    const target = habit.dailyTargetCount ?? 1;
    const checkIns = await habitRepository.findManyCheckIns(
      { habitId },
      { date: 'asc' },
    );

    // 构造已完成日期集合（count >= 目标）
    const completed = new Set(checkIns.filter(c => c.count >= target).map(c => c.date));

    // 最长连续：在已完成日期集合上求最长连续区间
    const sorted = Array.from(completed).sort();
    let longest = 0;
    let run = 0;
    let prev = null;
    for (const d of sorted) {
      if (prev && daysApart(prev, d) === 1) {
        run += 1;
      } else {
        run = 1;
      }
      if (run > longest) longest = run;
      prev = d;
    }

    // 当前连续：从今天往回数；若今天未完成，则从昨天开始
    const t = today();
    let cursor = completed.has(t) ? t : (() => {
      const d = new Date(t);
      d.setDate(d.getDate() - 1);
      return formatStr(d);
    })();
    let current = 0;
    while (completed.has(cursor)) {
      current += 1;
      const d = new Date(cursor);
      d.setDate(d.getDate() - 1);
      cursor = formatStr(d);
    }

    return { currentStreak: current, longestStreak: longest };
  }
}

/** 计算两个 YYYY-MM-DD 相差天数 */
function daysApart(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

/** Date → YYYY-MM-DD */
function formatStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default new HabitService();
