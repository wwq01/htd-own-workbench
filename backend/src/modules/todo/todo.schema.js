/**
 * 待办模块 - Zod 参数校验
 */
import { z } from 'zod';
import { TODO_CATEGORY, TODO_PRIORITY, TODO_STATUS } from '../../common/constants/enums.js';

const CATEGORY_VALUES = Object.values(TODO_CATEGORY);
const PRIORITY_VALUES = Object.values(TODO_PRIORITY);
const STATUS_VALUES = Object.values(TODO_STATUS);

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const createTodoSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题长度不能超过 200 字符'),
  category: z.enum(CATEGORY_VALUES).default(TODO_CATEGORY.DAILY),
  priority: z.enum(PRIORITY_VALUES).default(TODO_PRIORITY.MEDIUM),
  todoDate: z.string().regex(DATE_REGEX, '日期格式必须为 YYYY-MM-DD'),
  status: z.enum(STATUS_VALUES).default(TODO_STATUS.PENDING),
  estimatedTime: z.string().max(50, '预计耗时最多 50 字符').nullable().optional().or(z.literal('')),
  remark: z.string().max(1000, '备注最多 1000 字符').nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateTodoSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  title: z.string().min(1, '标题不能为空').max(200, '标题长度不能超过 200 字符').optional(),
  category: z.enum(CATEGORY_VALUES).optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
  status: z.enum(STATUS_VALUES).optional(),
  todoDate: z.string().regex(DATE_REGEX, '日期格式必须为 YYYY-MM-DD').optional(),
  estimatedTime: z.string().max(50, '预计耗时最多 50 字符').nullable().optional().or(z.literal('')),
  remark: z.string().max(1000, '备注最多 1000 字符').nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listTodoSchema = z.object({
  todoDate: z.string().regex(DATE_REGEX, '日期格式必须为 YYYY-MM-DD').optional(),
  startDate: z.string().regex(DATE_REGEX).optional(),
  endDate: z.string().regex(DATE_REGEX).optional(),
  category: z.enum(CATEGORY_VALUES).optional(),
  status: z.enum(STATUS_VALUES).optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const migratePendingSchema = z.object({
  // 今日 → 明日迁移：传入 todayDate，迁移 status=pending 且 todoDate=todayDate 的条目
  fromDate: z.string().regex(DATE_REGEX),
  toDate: z.string().regex(DATE_REGEX),
  // 可选：只迁移指定 id 列表；不传则迁移所有 pending
  ids: z.array(z.string()).optional(),
});

export const todoIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});
