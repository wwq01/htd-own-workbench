/**
 * 复盘模块 - Zod 参数校验
 */
import { z } from 'zod';
import { REVIEW_TYPE, REVIEW_RESULT } from '../../common/constants/enums.js';

const TYPE_VALUES = Object.values(REVIEW_TYPE);
const RESULT_VALUES = Object.values(REVIEW_RESULT);

const WEEK_KEY_REGEX = /^\d{4}-W\d{2}$/;

export const createReviewSchema = z.object({
  type: z.enum(TYPE_VALUES),
  weekKey: z.string().regex(WEEK_KEY_REGEX, '周次格式应为 YYYY-Www').nullable().optional().or(z.literal('')),
  projectId: z.string().nullable().optional().or(z.literal('')),
  // 周复盘模板字段
  highlights: z.string().max(5000).nullable().optional().or(z.literal('')),
  pitfalls: z.string().max(5000).nullable().optional().or(z.literal('')),
  reusableExperience: z.string().max(5000).nullable().optional().or(z.literal('')),
  improvements: z.string().max(5000).nullable().optional().or(z.literal('')),
  // 项目复盘模板字段
  customerPainPoints: z.string().max(5000).nullable().optional().or(z.literal('')),
  presentationHighlights: z.string().max(5000).nullable().optional().or(z.literal('')),
  exposedWeakness: z.string().max(5000).nullable().optional().or(z.literal('')),
  reusableTips: z.string().max(5000).nullable().optional().or(z.literal('')),
  reviewResult: z.enum(RESULT_VALUES).nullable().optional().or(z.literal('')),
  remark: z.string().max(1000).nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateReviewSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  type: z.enum(TYPE_VALUES).optional(),
  weekKey: z.string().regex(WEEK_KEY_REGEX).nullable().optional().or(z.literal('')),
  projectId: z.string().nullable().optional().or(z.literal('')),
  highlights: z.string().max(5000).nullable().optional().or(z.literal('')),
  pitfalls: z.string().max(5000).nullable().optional().or(z.literal('')),
  reusableExperience: z.string().max(5000).nullable().optional().or(z.literal('')),
  improvements: z.string().max(5000).nullable().optional().or(z.literal('')),
  customerPainPoints: z.string().max(5000).nullable().optional().or(z.literal('')),
  presentationHighlights: z.string().max(5000).nullable().optional().or(z.literal('')),
  exposedWeakness: z.string().max(5000).nullable().optional().or(z.literal('')),
  reusableTips: z.string().max(5000).nullable().optional().or(z.literal('')),
  reviewResult: z.enum(RESULT_VALUES).nullable().optional().or(z.literal('')),
  remark: z.string().max(1000).nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listReviewSchema = z.object({
  type: z.enum(TYPE_VALUES).optional(),
  weekKey: z.string().regex(WEEK_KEY_REGEX).optional(),
  projectId: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const reviewIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});
