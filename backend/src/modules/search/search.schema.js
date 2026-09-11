/**
 * 全文搜索模块 - Zod 参数校验
 */
import { z } from 'zod';

export const searchSchema = z.object({
  q: z.string().min(1, '搜索关键词不能为空'),
  modules: z.string().optional(), // 逗号分隔的模块 key，留空搜全部
  limit: z.coerce.number().int().positive().max(50).optional().default(5),
});
