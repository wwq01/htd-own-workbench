/**
 * 习惯打卡模块 - Zod 参数校验
 */
import { z } from 'zod';
import { HABIT_FREQUENCY } from '../../common/constants/enums.js';

const FREQUENCY_VALUES = Object.values(HABIT_FREQUENCY);

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const createHabitSchema = z.object({
  name: z.string().min(1, '习惯名称不能为空').max(100, '习惯名称长度不能超过 100 字符'),
  frequency: z.enum(FREQUENCY_VALUES, { errorMap: () => ({ message: '打卡频率非法' }) }),
  dailyTargetCount: z.number().int().positive().default(1),
  weeklyTargetDays: z.number().int().min(1).max(7).nullable().optional(),
  icon: z.string().max(16, '图标最多 16 字符').nullable().optional(),
  remark: z.string().max(1000, '备注最多 1000 字符').nullable().optional(),
});

export const updateHabitSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  name: z.string().min(1, '习惯名称不能为空').max(100, '习惯名称长度不能超过 100 字符').optional(),
  frequency: z.enum(FREQUENCY_VALUES, { errorMap: () => ({ message: '打卡频率非法' }) }).optional(),
  dailyTargetCount: z.number().int().positive().optional(),
  weeklyTargetDays: z.number().int().min(1).max(7).nullable().optional(),
  icon: z.string().max(16, '图标最多 16 字符').nullable().optional(),
  remark: z.string().max(1000, '备注最多 1000 字符').nullable().optional(),
});

export const listHabitSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const habitIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});

export const checkInSchema = z.object({
  habitId: z.string().min(1, '习惯 ID 不能为空'),
  date: z.string().regex(DATE_REGEX, '日期格式必须为 YYYY-MM-DD'),
  count: z.number().int().positive().default(1),
  note: z.string().max(500, '备注最多 500 字符').nullable().optional(),
});
