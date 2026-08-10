/**
 * 学习记录模块 - Zod 参数校验
 */
import { z } from 'zod';
import { STUDY_TYPE } from '../../common/constants/enums.js';

const TYPE_VALUES = Object.values(STUDY_TYPE);
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const createStudyRecordSchema = z.object({
  type: z.enum(TYPE_VALUES).default(STUDY_TYPE.PROFESSIONAL),
  techDirection: z.string().max(50, '技术方向最多 50 字符').nullable().optional().or(z.literal('')),
  topic: z.string().min(1, '学习主题不能为空').max(200, '学习主题最多 200 字符'),
  notes: z.string().max(10000, '核心笔记最多 10000 字符').nullable().optional().or(z.literal('')),
  source: z.string().max(500, '资料来源最多 500 字符').nullable().optional().or(z.literal('')),
  duration: z.number().min(0, '学习时长不能为负数').max(24, '单次学习时长不能超过 24 小时').default(0),
  studyDate: z.string().regex(DATE_REGEX, '学习日期格式必须为 YYYY-MM-DD'),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateStudyRecordSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  type: z.enum(TYPE_VALUES).optional(),
  techDirection: z.string().max(50).nullable().optional().or(z.literal('')),
  topic: z.string().min(1, '学习主题不能为空').max(200).optional(),
  notes: z.string().max(10000).nullable().optional().or(z.literal('')),
  source: z.string().max(500).nullable().optional().or(z.literal('')),
  duration: z.number().min(0).max(24).optional(),
  studyDate: z.string().regex(DATE_REGEX).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listStudyRecordSchema = z.object({
  type: z.enum(TYPE_VALUES).optional(),
  techDirection: z.string().max(50).optional(),
});

export const studyRecordIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});
