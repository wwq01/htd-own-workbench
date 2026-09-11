/**
 * 漏洞跟踪库模块 - Zod 参数校验
 */
import { z } from 'zod';
import { VULN_FIX_STATUS, SEVERITY } from '../../common/constants/enums.js';

const FIX_STATUS_VALUES = Object.values(VULN_FIX_STATUS);
const SEVERITY_VALUES = Object.values(SEVERITY);

export const createVulnSchema = z.object({
  assetGroup: z.string().min(1, '资产组不能为空').max(100, '资产组长度不能超过 100 字符'),
  vulnId: z.string().min(1, '漏洞编号不能为空').max(100, '漏洞编号长度不能超过 100 字符'),
  affectedProduct: z.string().max(300).nullable().optional().or(z.literal('')),
  exploitMethod: z.string().max(2000).nullable().optional().or(z.literal('')),
  reproduction: z.string().max(2000).nullable().optional().or(z.literal('')),
  fixStatus: z.enum(FIX_STATUS_VALUES).default(VULN_FIX_STATUS.OPEN),
  severity: z.enum(SEVERITY_VALUES).default(SEVERITY.MEDIUM),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateVulnSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  assetGroup: z.string().min(1).max(100).optional(),
  vulnId: z.string().min(1).max(100).optional(),
  affectedProduct: z.string().max(300).nullable().optional().or(z.literal('')),
  exploitMethod: z.string().max(2000).nullable().optional().or(z.literal('')),
  reproduction: z.string().max(2000).nullable().optional().or(z.literal('')),
  // 严重度是属性，可直接更新；修复状态须走 changeStatus
  severity: z.enum(SEVERITY_VALUES).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listVulnSchema = z.object({
  // 资产组为隔离维度，列表必填（缺失时由 service 返回空列表）
  assetGroup: z.string().min(1).optional(),
  q: z.string().optional(),
  fixStatus: z.enum(FIX_STATUS_VALUES).optional(),
  severity: z.enum(SEVERITY_VALUES).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'sortOrder', 'severity', 'fixStatus']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export const vulnIdSchema = z.object({ id: z.string().min(1, 'ID 不能为空') });

export const changeVulnStatusSchema = z.object({ status: z.enum(FIX_STATUS_VALUES) });

/** S1-5：资产分组列表（去空去重后持久化，上限 100 项防止滥用） */
export const assetGroupsSchema = z
  .array(z.string().min(1).max(50))
  .max(100, '资产分组数量超出上限');
