import { z } from 'zod';

/**
 * §8.3 字段 / 状态机配置平台 - 校验契约
 * 下拉项集、自定义扩展字段、可配置状态机 三类配置统一存储于 SystemSetting。
 */

// 自定义扩展字段类型：单行文本 / 多行文本（V1.5 §8.3）
export const customFieldTypeSchema = z.enum(['single_line', 'multi_line']);

// 单个自定义字段定义
export const customFieldDefSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, '字段标识须以字母开头，仅含字母、数字、下划线'),
  label: z.string().min(1).max(40),
  type: customFieldTypeSchema,
  required: z.boolean().optional().default(false),
  placeholder: z.string().max(80).optional(),
});

// 可配置状态机：状态集合 + 迁移映射（from -> [to]）+ 初始态
export const stateMachineSchema = z.object({
  states: z.array(z.string().min(1).max(30)).min(1),
  transitions: z.record(z.string(), z.array(z.string().min(1).max(30))),
  initial: z.string().min(1).max(30).optional(),
});

// 整体配置平台
export const fieldConfigSchema = z.object({
  dropdowns: z.record(z.string(), z.array(z.string().min(1).max(40))).optional().default({}),
  customFields: z.record(z.string(), z.array(customFieldDefSchema)).optional().default({}),
  stateMachines: z.record(z.string(), stateMachineSchema).optional().default({}),
});

export const partialFieldConfigSchema = fieldConfigSchema.partial();
