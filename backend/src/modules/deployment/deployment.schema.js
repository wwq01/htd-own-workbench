/**
 * 部署记录模块 - Zod 参数校验
 */
import { z } from 'zod';
import { DEPLOY_ENV_TYPE } from '../../common/constants/enums.js';

const ENV_VALUES = Object.values(DEPLOY_ENV_TYPE);

export const createDeploymentSchema = z.object({
  name: z.string().min(1, '环境名称不能为空').max(200, '名称长度不能超过 200 字符'),
  envType: z.enum(ENV_VALUES).default(DEPLOY_ENV_TYPE.TEST),
  deviceType: z.string().max(200).nullable().optional().or(z.literal('')),
  ipAddress: z.string().max(100).nullable().optional().or(z.literal('')),
  config: z.string().max(5000).nullable().optional().or(z.literal('')),
  steps: z.string().max(5000).nullable().optional().or(z.literal('')),
  commands: z.string().max(5000).nullable().optional().or(z.literal('')),
  remark: z.string().max(2000).nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateDeploymentSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  name: z.string().min(1).max(200).optional(),
  envType: z.enum(ENV_VALUES).optional(),
  deviceType: z.string().max(200).nullable().optional().or(z.literal('')),
  ipAddress: z.string().max(100).nullable().optional().or(z.literal('')),
  config: z.string().max(5000).nullable().optional().or(z.literal('')),
  steps: z.string().max(5000).nullable().optional().or(z.literal('')),
  commands: z.string().max(5000).nullable().optional().or(z.literal('')),
  remark: z.string().max(2000).nullable().optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const listDeploymentSchema = z.object({
  envType: z.enum(ENV_VALUES).optional(),
  keyword: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const deploymentIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});
