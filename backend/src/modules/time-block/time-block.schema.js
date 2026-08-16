/**
 * 时间块模块 - Zod 参数校验
 */
import { z } from 'zod';
import { TIME_BLOCK_TYPE } from '../../common/constants/enums.js';

const TYPE_VALUES = Object.values(TIME_BLOCK_TYPE);

// 兼容 ISO 8601 与 datetime-local（YYYY-MM-DDTHH:mm[:ss]）
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?$/;

export const createTimeBlockSchema = z.object({
  startedAt: z.string().regex(ISO_DATETIME_REGEX, '开始时间格式不正确'),
  endedAt: z.string().regex(ISO_DATETIME_REGEX).nullable().optional(),
  plannedMinutes: z.number().int().positive('计划时长必须为正整数').default(25),
  actualMinutes: z.number().int().nonnegative('实际时长不能为负').default(0),
  type: z.enum(TYPE_VALUES).default(TIME_BLOCK_TYPE.WORK),
  relatedProjectId: z.string().min(1).nullable().optional(),
  relatedStudyId: z.string().min(1).nullable().optional(),
  note: z.string().max(1000, '备注最多 1000 字符').nullable().optional(),
  interrupted: z.boolean().default(false),
});

export const updateTimeBlockSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  startedAt: z.string().regex(ISO_DATETIME_REGEX, '开始时间格式不正确').optional(),
  endedAt: z.string().regex(ISO_DATETIME_REGEX).nullable().optional(),
  plannedMinutes: z.number().int().positive('计划时长必须为正整数').optional(),
  actualMinutes: z.number().int().nonnegative('实际时长不能为负').optional(),
  type: z.enum(TYPE_VALUES).optional(),
  relatedProjectId: z.string().min(1).nullable().optional(),
  relatedStudyId: z.string().min(1).nullable().optional(),
  note: z.string().max(1000, '备注最多 1000 字符').nullable().optional(),
  interrupted: z.boolean().optional(),
});

export const listTimeBlockSchema = z.object({
  type: z.enum(TYPE_VALUES).optional(),
  startedFrom: z.string().regex(ISO_DATETIME_REGEX).optional(),
  startedTo: z.string().regex(ISO_DATETIME_REGEX).optional(),
});

export const startTimeBlockSchema = z.object({
  type: z.enum(TYPE_VALUES).default(TIME_BLOCK_TYPE.WORK),
  plannedMinutes: z.number().int().positive('计划时长必须为正整数').default(25),
  relatedProjectId: z.string().min(1).nullable().optional(),
  relatedStudyId: z.string().min(1).nullable().optional(),
  note: z.string().max(1000, '备注最多 1000 字符').nullable().optional(),
});

export const stopTimeBlockSchema = z.object({
  interrupted: z.boolean().default(false),
});

export const timeBlockIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});
