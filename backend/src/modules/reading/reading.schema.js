/**
 * 阅读 / 资料模块 - Zod 参数校验
 */
import { z } from 'zod';
import { READING_TYPE, READING_STATUS } from '../../common/constants/enums.js';
import { dropdownValue, stateValue } from '../../lib/configSchema.js';

// 类型 / 状态取自「字段 / 状态机配置平台」（§8.3），未配置时回落默认枚举
const typeValue = () => dropdownValue('reading.type', '非法的阅读资料类型');
const statusValue = () => stateValue('reading.status', '非法的阅读状态');

export const createReadingSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题长度不能超过 200 字符'),
  sourceUrl: z.string().max(500).nullable().optional().or(z.literal('')),
  type: typeValue().default(READING_TYPE.ARTICLE),
  tags: z.array(z.string()).optional(),
  readingStatus: statusValue().default(READING_STATUS.UNREAD),
  notes: z.string().max(20000).nullable().optional().or(z.literal('')),
  customFields: z.record(z.string(), z.any()).optional(),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateReadingSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  title: z.string().min(1).max(200).optional(),
  sourceUrl: z.string().max(500).nullable().optional().or(z.literal('')),
  type: typeValue().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(20000).nullable().optional().or(z.literal('')),
  customFields: z.record(z.string(), z.any()).optional(),
  readingStatus: statusValue().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listReadingSchema = z.object({
  q: z.string().optional(),
  type: typeValue().optional(),
  readingStatus: statusValue().optional(),
  tags: z.string().optional(),
  fields: z.string().optional(), // V1.5 ?fields 字段裁剪
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'sortOrder', 'readingStatus', 'type']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export const readingIdSchema = z.object({ id: z.string().min(1, 'ID 不能为空') });

export const changeReadingStatusSchema = z.object({ status: statusValue() });
