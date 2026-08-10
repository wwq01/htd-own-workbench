/**
 * 项目里程碑模块 - Zod 参数校验
 */
import { z } from 'zod';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const createMilestoneSchema = z.object({
  projectId: z.string().min(1, '项目 ID 不能为空'),
  name: z.string().min(1, '里程碑名称不能为空').max(100, '里程碑名称最多 100 字符'),
  dueDate: z.string().regex(DATE_REGEX, '日期格式必须为 YYYY-MM-DD'),
  completed: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateMilestoneSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  name: z.string().min(1, '里程碑名称不能为空').max(100).optional(),
  dueDate: z.string().regex(DATE_REGEX).optional(),
  completed: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listMilestoneSchema = z.object({
  projectId: z.string().min(1, '项目 ID 不能为空').optional(),
});

export const milestoneIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});
