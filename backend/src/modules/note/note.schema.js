/**
 * S2-4 双轨笔记模块 - Zod 参数校验
 *
 * 笔记采用 sourceType + sourceId 软关联（沿用 VaultItem 惯例），
 * 可为阅读资料 / 会议 / 沉淀等任意来源挂载笔记。
 * anchor 为原文字符偏移 JSON 串：{ start, end }，用于笔记 ↔ 原文双向跳转。
 */
import { z } from 'zod';
import { NOTE_SOURCE_TYPE } from '../../common/constants/enums.js';

const SOURCE_TYPE_VALUES = Object.values(NOTE_SOURCE_TYPE);

// 锚点：JSON 字符串 { start, end }，非负整数且 end >= start
const anchorSchema = z
  .string()
  .max(200, '锚点数据过长')
  .refine((val) => {
    if (!val) return true;
    try {
      const obj = JSON.parse(val);
      if (!obj || typeof obj !== 'object') return false;
      const { start, end } = obj;
      if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
      if (start < 0 || end < 0 || end < start) return false;
      return true;
    } catch {
      return false;
    }
  }, '锚点格式非法，应为 {"start":number,"end":number} 且 end >= start');

export const createNoteSchema = z.object({
  sourceType: z.enum(SOURCE_TYPE_VALUES).default(NOTE_SOURCE_TYPE.READING),
  sourceId: z.string().max(200, '来源ID过长').nullable().optional(),
  content: z.string().min(1, '笔记内容不能为空').max(20000, '笔记内容不能超过 20000 字符'),
  quote: z.string().max(4000, '引用片段过长').nullable().optional(),
  anchor: anchorSchema.nullable().optional(),
  tags: z.array(z.string().max(50, '单个标签最多 50 字符')).optional(),
});

export const updateNoteSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  sourceType: z.enum(SOURCE_TYPE_VALUES).optional(),
  sourceId: z.string().max(200, '来源ID过长').nullable().optional(),
  content: z.string().min(1, '笔记内容不能为空').max(20000, '笔记内容不能超过 20000 字符').optional(),
  quote: z.string().max(4000, '引用片段过长').nullable().optional(),
  anchor: anchorSchema.nullable().optional(),
  tags: z.array(z.string().max(50, '单个标签最多 50 字符')).optional(),
});

export const listNoteSchema = z.object({
  sourceType: z.enum(SOURCE_TYPE_VALUES).optional(),
  sourceId: z.string().max(200, '来源ID过长').optional(),
  tag: z.string().max(50, '标签筛选词过长').optional(),
});

export const noteIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});
