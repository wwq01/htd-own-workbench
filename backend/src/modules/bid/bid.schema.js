/**
 * 投标档案模块 - Zod 参数校验
 */
import { z } from 'zod';
import { BID_STATUS, BID_RESULT } from '../../common/constants/enums.js';

const STATUS_VALUES = Object.values(BID_STATUS);
const RESULT_VALUES = Object.values(BID_RESULT);
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const createBidSchema = z.object({
  bidNo: z.string().min(1, '投标编号不能为空').max(100, '编号长度不能超过 100 字符'),
  deadline: z.string().regex(DATE_REGEX, '截止日期格式必须为 YYYY-MM-DD').nullable().optional().or(z.literal('')),
  bidVersion: z.string().max(100).nullable().optional().or(z.literal('')),
  bidResult: z.enum(RESULT_VALUES).default(BID_RESULT.PENDING),
  status: z.enum(STATUS_VALUES).default(BID_STATUS.DRAFT),
  projectMilestoneId: z.string().min(1).nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateBidSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  bidNo: z.string().min(1).max(100).optional(),
  deadline: z.string().regex(DATE_REGEX, '截止日期格式必须为 YYYY-MM-DD').nullable().optional().or(z.literal('')),
  bidVersion: z.string().max(100).nullable().optional().or(z.literal('')),
  bidResult: z.enum(RESULT_VALUES).optional(),
  projectMilestoneId: z.string().min(1).nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listBidSchema = z.object({
  q: z.string().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  bidResult: z.enum(RESULT_VALUES).optional(),
  milestoneId: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'sortOrder', 'status', 'bidResult']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export const bidIdSchema = z.object({ id: z.string().min(1, 'ID 不能为空') });

export const changeBidStatusSchema = z.object({ status: z.enum(STATUS_VALUES) });
