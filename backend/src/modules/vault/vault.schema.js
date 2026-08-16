/**
 * 沉淀模块 - Zod 参数校验
 */
import { z } from 'zod';
import { VAULT_STATUS, VAULT_SOURCE_TYPE } from '../../common/constants/enums.js';

const STATUS_VALUES = Object.values(VAULT_STATUS);
const SOURCE_TYPE_VALUES = Object.values(VAULT_SOURCE_TYPE);

export const createVaultSchema = z.object({
  topic: z.string().min(1, '沉淀主题不能为空').max(200, '主题长度不能超过 200 字符'),
  content: z.string().max(20000, '内容长度不能超过 20000 字符').optional(),
  tags: z.array(z.string().max(50, '单个标签最多 50 字符')).optional(),
  status: z.enum(STATUS_VALUES).optional(),
  sourceType: z.enum(SOURCE_TYPE_VALUES).optional(),
  sourceId: z.string().max(200, '来源ID过长').nullable().optional(),
  sourceUrl: z.string().max(2000, '来源链接过长').nullable().optional(),
});

export const updateVaultSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  topic: z.string().min(1, '沉淀主题不能为空').max(200, '主题长度不能超过 200 字符').optional(),
  content: z.string().max(20000, '内容长度不能超过 20000 字符').optional(),
  tags: z.array(z.string().max(50, '单个标签最多 50 字符')).optional(),
  status: z.enum(STATUS_VALUES).optional(),
  sourceType: z.enum(SOURCE_TYPE_VALUES).optional(),
  sourceId: z.string().max(200, '来源ID过长').nullable().optional(),
  sourceUrl: z.string().max(2000, '来源链接过长').nullable().optional(),
});

export const listVaultSchema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  sourceType: z.enum(SOURCE_TYPE_VALUES).optional(),
  tag: z.string().max(50, '标签筛选词过长').optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const vaultIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});
