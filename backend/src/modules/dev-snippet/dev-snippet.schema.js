/**
 * 代码片段模块 - Zod 参数校验
 */
import { z } from 'zod';

export const createDevSnippetSchema = z.object({
  name: z.string().min(1, '片段名称不能为空').max(100, '片段名称最多 100 字符'),
  category: z.string().max(50, '分类最多 50 字符').default('其他'),
  code: z.string().min(1, '代码内容不能为空').max(50000, '代码内容最多 50000 字符'),
  remark: z.string().max(1000, '备注最多 1000 字符').nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateDevSnippetSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  name: z.string().min(1, '片段名称不能为空').max(100).optional(),
  category: z.string().max(50).optional(),
  code: z.string().min(1, '代码内容不能为空').max(50000).optional(),
  remark: z.string().max(1000).nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listDevSnippetSchema = z.object({
  category: z.string().max(50).optional(),
  keyword: z.string().max(100).optional(),
});

export const devSnippetIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});
