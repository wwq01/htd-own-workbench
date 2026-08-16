/**
 * 财务收支模块 - Zod 参数校验
 */
import { z } from 'zod';
import { FINANCE_TYPE, FINANCE_CATEGORY } from '../../common/constants/enums.js';

const TYPE_VALUES = Object.values(FINANCE_TYPE);
const CATEGORY_VALUES = Object.values(FINANCE_CATEGORY);

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_REGEX = /^\d{4}-\d{2}$/;

export const createFinanceSchema = z.object({
  date: z.string().regex(DATE_REGEX, '日期格式必须为 YYYY-MM-DD'),
  type: z.enum(TYPE_VALUES, { errorMap: () => ({ message: '收支类型不合法' }) }),
  amount: z.coerce.number({ invalid_type_error: '金额必须为数字' }).positive('金额必须为正数'),
  category: z.enum(CATEGORY_VALUES, { errorMap: () => ({ message: '收支分类不合法' }) }),
  subCategory: z.string().max(100, '子分类最多 100 字符').nullable().optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
  remark: z.string().max(1000, '备注最多 1000 字符').nullable().optional().or(z.literal('')),
});

export const updateFinanceSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  date: z.string().regex(DATE_REGEX, '日期格式必须为 YYYY-MM-DD').optional(),
  type: z.enum(TYPE_VALUES).optional(),
  amount: z.coerce.number({ invalid_type_error: '金额必须为数字' }).positive('金额必须为正数').optional(),
  category: z.enum(CATEGORY_VALUES).optional(),
  subCategory: z.string().max(100).nullable().optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
  remark: z.string().max(1000).nullable().optional().or(z.literal('')),
});

export const listFinanceSchema = z.object({
  type: z.enum(TYPE_VALUES).optional(),
  month: z.string().regex(MONTH_REGEX, '月份格式必须为 YYYY-MM').optional(),
  category: z.enum(CATEGORY_VALUES).optional(),
  keyword: z.string().optional(),
});

export const financeIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});

export const monthSchema = z.object({
  month: z.string().regex(MONTH_REGEX, '月份格式必须为 YYYY-MM'),
});
