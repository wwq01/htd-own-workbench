/**
 * 备忘模块 - Zod 参数校验
 */
import { z } from 'zod';

export const createMemoSchema = z.object({
  content: z.string().min(1, '备忘内容不能为空').max(1000, '备忘内容最多 1000 字符'),
});

export const updateMemoSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  content: z.string().min(1, '备忘内容不能为空').max(1000, '备忘内容最多 1000 字符'),
});

export const memoIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});

export const listMemoSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
