/**
 * POC 跟踪模块 - Zod 参数校验
 */
import { z } from 'zod';
import { POC_STATUS } from '../../common/constants/enums.js';

const STATUS_VALUES = Object.values(POC_STATUS);

export const createPocSchema = z.object({
  goal: z.string().min(1, 'POC 目标不能为空').max(500, '目标长度不能超过 500 字符'),
  environment: z.string().max(500).nullable().optional().or(z.literal('')),
  // 客户参与人：字符串数组，存储为 JSON 字符串
  customerParticipants: z.array(z.string()).nullable().optional(),
  result: z.string().max(2000).nullable().optional().or(z.literal('')),
  status: z.enum(STATUS_VALUES).default(POC_STATUS.DRAFT),
  projectId: z.string().min(1).nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updatePocSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  goal: z.string().min(1).max(500).optional(),
  environment: z.string().max(500).nullable().optional().or(z.literal('')),
  customerParticipants: z.array(z.string()).nullable().optional(),
  result: z.string().max(2000).nullable().optional().or(z.literal('')),
  projectId: z.string().min(1).nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listPocSchema = z.object({
  q: z.string().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  projectId: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'sortOrder', 'status']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export const pocIdSchema = z.object({ id: z.string().min(1, 'ID 不能为空') });

export const changePocStatusSchema = z.object({ status: z.enum(STATUS_VALUES) });
