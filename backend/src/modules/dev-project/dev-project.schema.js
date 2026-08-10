/**
 * 开发项目模块 - Zod 参数校验
 */
import { z } from 'zod';
import { DEV_PROJECT_STATUS } from '../../common/constants/enums.js';

const STATUS_VALUES = Object.values(DEV_PROJECT_STATUS);

export const createDevProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').max(100, '项目名称最多 100 字符'),
  description: z.string().max(2000, '项目描述最多 2000 字符').nullable().optional().or(z.literal('')),
  status: z.enum(STATUS_VALUES).default(DEV_PROJECT_STATUS.DEVELOPING),
  techStack: z.array(z.string().max(50)).default([]),
  todoItems: z.array(z.string().max(200)).default([]),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateDevProjectSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  name: z.string().min(1, '项目名称不能为空').max(100).optional(),
  description: z.string().max(2000).nullable().optional().or(z.literal('')),
  status: z.enum(STATUS_VALUES).optional(),
  techStack: z.array(z.string().max(50)).optional(),
  todoItems: z.array(z.string().max(200)).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listDevProjectSchema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  keyword: z.string().max(100).optional(),
});

export const devProjectIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});
