/**
 * 通用校验规则（Zod schemas 复用）
 */
import { z } from 'zod';

// ID 校验
export const idSchema = z.string().cuid().or(z.string().uuid()).or(z.number().positive());

// 分页参数
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 日期字符串
export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD');

// 枚举校验工厂
export const enumSchema = (enumObj) =>
  z.enum(Object.values(enumObj));
