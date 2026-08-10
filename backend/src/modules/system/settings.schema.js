import { z } from 'zod';
import path from 'path';

export const settingsUpdateSchema = z.object({
  theme: z.enum(['dark', 'light']).optional(),
  dataRoot: z.string().min(1).max(260).refine((value) => path.isAbsolute(value), '数据路径必须是绝对路径').optional(),
  backupFrequency: z.enum(['startup', 'daily', 'weekly', 'manual']).optional(),
  maxBackups: z.coerce.number().int().min(1).max(30).optional(),
});
