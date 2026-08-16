/**
 * 合同回款模块 - Zod 参数校验
 */
import { z } from 'zod';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const createContractSchema = z.object({
  contractNo: z.string().min(1, '合同编号不能为空').max(100, '合同编号最多 100 字符'),
  contractAmount: z.coerce.number({ invalid_type_error: '合同金额必须为数字' }).positive('合同金额必须为正数'),
  clientName: z.string().max(200, '客户名称最多 200 字符').nullable().optional().or(z.literal('')),
  nodes: z.string().optional(), // JSON 字符串，缺省 '[]'
  remark: z.string().max(1000, '备注最多 1000 字符').nullable().optional().or(z.literal('')),
});

export const updateContractSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  contractNo: z.string().min(1, '合同编号不能为空').max(100).optional(),
  contractAmount: z.coerce.number({ invalid_type_error: '合同金额必须为数字' }).positive('合同金额必须为正数').optional(),
  clientName: z.string().max(200).nullable().optional().or(z.literal('')),
  nodes: z.string().optional(),
  remark: z.string().max(1000).nullable().optional().or(z.literal('')),
});

export const listContractSchema = z.object({
  keyword: z.string().optional(),
  clientName: z.string().optional(),
});

export const contractIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});

export const updateNodeSchema = z.object({
  contractId: z.string().min(1, 'ID 不能为空'),
  nodeIndex: z.coerce.number({ invalid_type_error: '节点序号必须为数字' }).int('节点序号必须为整数').nonnegative('节点序号不能为负数'),
  receivedAmount: z.coerce.number({ invalid_type_error: '已回款金额必须为数字' }).nonnegative('已回款金额不能为负数'),
  receivedAt: z.string().regex(DATE_REGEX, '日期格式必须为 YYYY-MM-DD').optional(),
});
