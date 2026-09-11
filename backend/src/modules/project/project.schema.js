/**
 * 项目模块 - Zod 参数校验
 */
import { z } from 'zod';
import { PROJECT_PHASE, PROJECT_PRIORITY } from '../../common/constants/enums.js';
import { dropdownValue } from '../../lib/configSchema.js';

const PRIORITY_VALUES = Object.values(PROJECT_PRIORITY);
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// 阶段 / 安全领域取自「字段 / 状态机配置平台」（§8.3），未配置时回落默认枚举
const phaseValue = () => dropdownValue('project.phase', '非法的阶段');
const securityDomainValue = () => dropdownValue('project.securityDomain', '非法的安全领域');

export const createProjectSchema = z.object({
  customerName: z.string().min(1, '客户名称不能为空').max(100, '客户名称最多 100 字符'),
  phase: phaseValue().default(PROJECT_PHASE.REQUIREMENT),
  securityDomains: z.array(securityDomainValue()).default([]),
  priority: z.enum(PRIORITY_VALUES).default(PROJECT_PRIORITY.MEDIUM),
  background: z.string().max(2000, '项目背景最多 2000 字符').nullable().optional().or(z.literal('')),
  coreRequirements: z.string().max(2000, '核心需求最多 2000 字符').nullable().optional().or(z.literal('')),
  solutionVersion: z.string().max(100, '方案版本最多 100 字符').nullable().optional().or(z.literal('')),
  contactInfo: z.string().max(200, '联系人信息最多 200 字符').nullable().optional().or(z.literal('')),
  projectMemo: z.string().max(5000, '项目备忘最多 5000 字符').nullable().optional().or(z.literal('')),
  startDate: z.string().regex(DATE_REGEX, '日期格式必须为 YYYY-MM-DD').nullable().optional().or(z.literal('')),
  expectedEndDate: z.string().regex(DATE_REGEX, '日期格式必须为 YYYY-MM-DD').nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateProjectSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  customerName: z.string().min(1, '客户名称不能为空').max(100).optional(),
  phase: phaseValue().optional(),
  phaseReason: z.string().max(500, '阶段切换原因最多 500 字符').nullable().optional().or(z.literal('')),
  securityDomains: z.array(securityDomainValue()).optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
  background: z.string().max(2000).nullable().optional().or(z.literal('')),
  coreRequirements: z.string().max(2000).nullable().optional().or(z.literal('')),
  solutionVersion: z.string().max(100).nullable().optional().or(z.literal('')),
  contactInfo: z.string().max(200).nullable().optional().or(z.literal('')),
  projectMemo: z.string().max(5000).nullable().optional().or(z.literal('')),
  startDate: z.string().regex(DATE_REGEX).nullable().optional().or(z.literal('')),
  expectedEndDate: z.string().regex(DATE_REGEX).nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listProjectSchema = z.object({
  phase: phaseValue().optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
  securityDomain: securityDomainValue().optional(),
  keyword: z.string().max(100).optional(),
  fields: z.string().optional(), // V1.5 ?fields 字段裁剪
});

export const projectIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});
