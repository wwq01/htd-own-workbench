/**
 * 开发问题模块 - Zod 参数校验
 */
import { z } from 'zod';
import { DEV_ISSUE_STATUS } from '../../common/constants/enums.js';

const STATUS_VALUES = Object.values(DEV_ISSUE_STATUS);

export const createDevIssueSchema = z.object({
  title: z.string().min(1, '问题标题不能为空').max(200, '问题标题最多 200 字符'),
  status: z.enum(STATUS_VALUES).default(DEV_ISSUE_STATUS.PENDING),
  symptom: z.string().max(5000, '问题现象最多 5000 字符').nullable().optional().or(z.literal('')),
  investigation: z.string().max(10000, '排查过程最多 10000 字符').nullable().optional().or(z.literal('')),
  solution: z.string().max(10000, '解决方案最多 10000 字符').nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateDevIssueSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  title: z.string().min(1, '问题标题不能为空').max(200).optional(),
  status: z.enum(STATUS_VALUES).optional(),
  symptom: z.string().max(5000).nullable().optional().or(z.literal('')),
  investigation: z.string().max(10000).nullable().optional().or(z.literal('')),
  solution: z.string().max(10000).nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listDevIssueSchema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  keyword: z.string().max(100).optional(),
});

export const devIssueIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});
