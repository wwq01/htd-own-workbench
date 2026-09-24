/**
 * 本地 Agent 通道 - Zod 参数校验
 */
import { z } from 'zod';

export const createAgentTaskSchema = z.object({
  title: z.string().min(1, '任务标题不能为空').max(200, '标题最多 200 字符').optional(),
  prompt: z.string().min(1, '指令内容不能为空').max(4000, '指令最多 4000 字符'),
  skillKey: z.string().min(1).max(64).optional().default('auto'),
  autoRun: z.boolean().optional().default(true),
  // wait=true（默认）：提交后等待执行完成，保持既有同步契约
  // wait=false：入队后立即返回 pending，实现真正的异步提交
  wait: z.boolean().optional().default(true),
});

export const agentTaskIdSchema = z.object({
  id: z.string().min(1, '任务 ID 不能为空'),
});

export const listAgentTaskSchema = z.object({
  status: z.enum(['pending', 'running', 'succeeded', 'failed', 'cancelled']).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
});
