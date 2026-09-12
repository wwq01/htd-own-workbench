/**
 * S2-5 RFP 条目级应答模块 - Zod 参数校验
 *
 * 证据挂载（evidence）采用通用软关联：{ sourceType, sourceId, label }，
 * 与 S2-4 Note 的 sourceType/sourceId 同源设计，无外键、无级联。
 */
import { z } from 'zod';
import {
  RFP_RESPONSE_TYPE,
  RFP_ITEM_STATUS,
  EVIDENCE_SOURCE_TYPE,
} from '../../common/constants/enums.js';

const RESPONSE_VALUES = Object.values(RFP_RESPONSE_TYPE);
const STATUS_VALUES = Object.values(RFP_ITEM_STATUS);
const EVIDENCE_VALUES = Object.values(EVIDENCE_SOURCE_TYPE);

/**
 * evidence 兼容两种入参：JSON 字符串（DB 直传 / 表单）与数组（API）。
 * 非法 JSON 保留原值交给数组校验报错，避免吞掉错误。
 */
const evidenceInput = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  },
  z
    .array(
      z.object({
        sourceType: z.enum(EVIDENCE_VALUES),
        sourceId: z.string().min(1, '证据来源 ID 不能为空').max(100, '证据来源 ID 过长'),
        label: z.string().max(200, '证据说明过长').nullable().optional(),
      })
    )
    .max(50, '单个条目最多挂载 50 条证据')
);

const optionalText = (max) =>
  z.string().max(max).nullable().optional().or(z.literal(''));

export const createRfpItemSchema = z.object({
  bidId: z.string().min(1, '关联投标 ID 不能为空'),
  code: optionalText(50),
  title: z.string().min(1, '条目标题不能为空').max(200, '条目标题不能超过 200 字符'),
  requirement: optionalText(4000),
  response: optionalText(4000),
  responseType: z.enum(RESPONSE_VALUES).default(RFP_RESPONSE_TYPE.PENDING),
  status: z.enum(STATUS_VALUES).default(RFP_ITEM_STATUS.TODO),
  owner: optionalText(50),
  evidence: evidenceInput.default([]),
  remark: optionalText(1000),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateRfpItemSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  code: optionalText(50).optional(),
  title: z.string().min(1).max(200).optional(),
  requirement: optionalText(4000).optional(),
  response: optionalText(4000).optional(),
  responseType: z.enum(RESPONSE_VALUES).optional(),
  status: z.enum(STATUS_VALUES).optional(),
  owner: optionalText(50).optional(),
  evidence: evidenceInput.optional(),
  remark: optionalText(1000).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listRfpItemSchema = z.object({
  bidId: z.string().optional(),
  q: z.string().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  responseType: z.enum(RESPONSE_VALUES).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'sortOrder', 'status', 'responseType']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export const rfpItemIdSchema = z.object({ id: z.string().min(1, 'ID 不能为空') });

export const changeRfpItemStatusSchema = z.object({ status: z.enum(STATUS_VALUES) });

export const rfpStatsSchema = z.object({ bidId: z.string().min(1, '关联投标 ID 不能为空') });
