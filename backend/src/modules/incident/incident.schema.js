/**
 * 应急响应记录模块 - Zod 参数校验
 */
import { z } from 'zod';
import { EMERGENCY_STATUS, SEVERITY } from '../../common/constants/enums.js';

const STATUS_VALUES = Object.values(EMERGENCY_STATUS);
const SEVERITY_VALUES = Object.values(SEVERITY);

export const createIncidentSchema = z.object({
  title: z.string().min(1, '事件标题不能为空').max(200, '标题长度不能超过 200 字符'),
  // 时间线 / 处置动作：JSON 数组，创建时可选
  eventTimeline: z.array(z.object({
    time: z.string().min(1, '时间不能为空'),
    event: z.string().min(1, '事件描述不能为空'),
    detail: z.string().optional(),
  })).nullable().optional(),
  responseActions: z.array(z.object({
    action: z.string().min(1, '处置动作不能为空'),
    owner: z.string().optional(),
    result: z.string().optional(),
  })).nullable().optional(),
  review: z.string().max(2000).nullable().optional().or(z.literal('')),
  status: z.enum(STATUS_VALUES).default(EMERGENCY_STATUS.OPEN),
  severity: z.enum(SEVERITY_VALUES).default(SEVERITY.MEDIUM),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateIncidentSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  title: z.string().min(1).max(200).optional(),
  review: z.string().max(2000).nullable().optional().or(z.literal('')),
  // 严重度是属性，可直接更新；状态须走 changeStatus
  severity: z.enum(SEVERITY_VALUES).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listIncidentSchema = z.object({
  q: z.string().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  severity: z.enum(SEVERITY_VALUES).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'sortOrder', 'status', 'severity']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export const incidentIdSchema = z.object({ id: z.string().min(1, 'ID 不能为空') });

export const changeIncidentStatusSchema = z.object({ status: z.enum(STATUS_VALUES) });

// 时间线条目（追加时单条校验）
export const incidentTimelineEntrySchema = z.object({
  time: z.string().min(1, '时间不能为空'),
  event: z.string().min(1, '事件描述不能为空'),
  detail: z.string().optional(),
});

// 处置动作条目（追加时单条校验）
export const incidentActionEntrySchema = z.object({
  action: z.string().min(1, '处置动作不能为空'),
  owner: z.string().optional(),
  result: z.string().optional(),
});
