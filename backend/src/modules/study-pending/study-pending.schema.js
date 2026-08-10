/**
 * 待学清单模块 - Zod 参数校验
 */
import { z } from 'zod';

export const createStudyPendingSchema = z.object({
  resourceType: z.string().max(50, '资源类型最多 50 字符').nullable().optional().or(z.literal('')),
  title: z.string().min(1, '资源标题不能为空').max(200, '资源标题最多 200 字符'),
  sourceLink: z.string().max(1000, '来源链接最多 1000 字符').nullable().optional().or(z.literal('')),
  remark: z.string().max(1000, '备注最多 1000 字符').nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateStudyPendingSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  resourceType: z.string().max(50).nullable().optional().or(z.literal('')),
  title: z.string().min(1, '资源标题不能为空').max(200).optional(),
  sourceLink: z.string().max(1000).nullable().optional().or(z.literal('')),
  remark: z.string().max(1000).nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listStudyPendingSchema = z.object({
  completed: z.union([z.boolean(), z.string()]).optional(),
});

export const studyPendingIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});

/**
 * 标记已学习转学习记录时的补充字段（学习时长、学习日期、核心笔记等）
 */
export const completeStudyPendingSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  duration: z.number().min(0, '学习时长不能为负数').max(24, '单次学习时长不能超过 24 小时').default(0),
  studyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '学习日期格式必须为 YYYY-MM-DD'),
  type: z.enum(['专业学习', '通用学习']).default('专业学习'),
  techDirection: z.string().max(50).nullable().optional().or(z.literal('')),
  notes: z.string().max(10000).nullable().optional().or(z.literal('')),
});
