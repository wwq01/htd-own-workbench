/**
 * 凭据保险箱模块 - Zod 参数校验
 */
import { z } from 'zod';
import { SECRET_TYPE } from '../../common/constants/enums.js';

const TYPE_VALUES = Object.values(SECRET_TYPE);

export const createSecretSchema = z.object({
  name: z.string().min(1, '凭据名称不能为空').max(200, '名称长度不能超过 200 字符'),
  type: z.enum(TYPE_VALUES).default(SECRET_TYPE.OTHER),
  content: z.string().min(1, '凭据内容不能为空').max(5000, '内容长度不能超过 5000 字符'),
  usageScenario: z.string().max(500).nullable().optional().or(z.literal('')),
  remark: z.string().max(2000).nullable().optional().or(z.literal('')),
  expiryDate: z.string().max(20).nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateSecretSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  name: z.string().min(1).max(200).optional(),
  type: z.enum(TYPE_VALUES).optional(),
  content: z.string().min(1).max(5000).optional(),
  usageScenario: z.string().max(500).nullable().optional().or(z.literal('')),
  remark: z.string().max(2000).nullable().optional().or(z.literal('')),
  expiryDate: z.string().max(20).nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listSecretSchema = z.object({
  type: z.enum(TYPE_VALUES).optional(),
  keyword: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const secretIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});
