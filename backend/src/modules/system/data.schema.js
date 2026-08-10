/**
 * 数据管理接口校验
 */
import { z } from 'zod';

const tableDataSchema = z.record(z.string(), z.unknown());

export const importDataSchema = z.object({
  version: z.string().min(1),
  exportedAt: z.string().min(1),
  confirm: z.literal(true),
  mode: z.enum(['skip', 'overwrite', 'full']).default('full'),
  tables: z.record(z.string(), z.array(tableDataSchema)),
});

export const destructiveActionSchema = z.object({
  confirm: z.literal(true),
  confirmationText: z.literal('确认清空'),
  scope: z.string().min(1).default('all'),
});
