/**
 * 项目模块 - Zod 参数校验
 */
import { z } from 'zod';
import { PROJECT_PHASE, PROJECT_PRIORITY, SECURITY_DOMAIN } from '../../common/constants/enums.js';

const PHASE_VALUES = Object.values(PROJECT_PHASE);
const PRIORITY_VALUES = Object.values(PROJECT_PRIORITY);
const SECURITY_DOMAIN_VALUES = Object.values(SECURITY_DOMAIN);
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const createProjectSchema = z.object({
  customerName: z.string().min(1, '客户名称不能为空').max(100, '客户名称最多 100 字符'),
  phase: z.enum(PHASE_VALUES).default(PROJECT_PHASE.REQUIREMENT),
  securityDomains: z.array(z.enum(SECURITY_DOMAIN_VALUES)).default([]),
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
  phase: z.enum(PHASE_VALUES).optional(),
  phaseReason: z.string().max(500, '阶段切换原因最多 500 字符').nullable().optional().or(z.literal('')),
  securityDomains: z.array(z.enum(SECURITY_DOMAIN_VALUES)).optional(),
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
  phase: z.enum(PHASE_VALUES).optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
  securityDomain: z.enum(SECURITY_DOMAIN_VALUES).optional(),
  keyword: z.string().max(100).optional(),
});

export const projectIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});
