/**
 * 娱乐内容模块 - Zod 参数校验
 */
import { z } from 'zod';
import { ENTERTAINMENT_TYPE, ENTERTAINMENT_STATUS } from '../../common/constants/enums.js';

const TYPE_VALUES = Object.values(ENTERTAINMENT_TYPE);
const STATUS_VALUES = Object.values(ENTERTAINMENT_STATUS);

export const createEntertainmentSchema = z.object({
  name: z.string().min(1, '作品名称不能为空').max(200, '名称长度不能超过 200 字符'),
  type: z.enum(TYPE_VALUES).default(ENTERTAINMENT_TYPE.GAME),
  status: z.enum(STATUS_VALUES).default(ENTERTAINMENT_STATUS.WANT),
  rating: z.number().int().min(0).max(5).default(0),
  progress: z.string().max(500, '进度记录最多 500 字符').nullable().optional().or(z.literal('')),
  review: z.string().max(2000, '个人短评最多 2000 字符').nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateEntertainmentSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  name: z.string().min(1).max(200).optional(),
  type: z.enum(TYPE_VALUES).optional(),
  status: z.enum(STATUS_VALUES).optional(),
  rating: z.number().int().min(0).max(5).optional(),
  progress: z.string().max(500).nullable().optional().or(z.literal('')),
  review: z.string().max(2000).nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listEntertainmentSchema = z.object({
  type: z.enum(TYPE_VALUES).optional(),
  status: z.enum(STATUS_VALUES).optional(),
  keyword: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const entertainmentIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});
