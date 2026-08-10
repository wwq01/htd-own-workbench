/**
 * 项目任务模块 - Zod 参数校验
 */
import { z } from 'zod';

export const createTaskSchema = z.object({
  projectId: z.string().min(1, '项目 ID 不能为空'),
  name: z.string().min(1, '任务名称不能为空').max(200, '任务名称最多 200 字符'),
  completed: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateTaskSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  name: z.string().min(1, '任务名称不能为空').max(200).optional(),
  completed: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listTaskSchema = z.object({
  projectId: z.string().min(1, '项目 ID 不能为空').optional(),
});

export const taskIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});
