/**
 * 会议模块 - Zod 参数校验
 */
import { z } from 'zod';

const agendaItemSchema = z.object({
  order: z.number().optional(),
  title: z.string().optional(),
  detail: z.string().optional(),
});

const decisionItemSchema = z.object({
  order: z.number().optional(),
  content: z.string().optional(),
  owner: z.string().optional(),
});

const actionItemSchema = z.object({
  id: z.string().optional(),
  content: z.string().optional(),
  owner: z.string().optional(),
  due: z.string().optional(),
  done: z.boolean().optional(),
  sourceLinked: z.boolean().optional(),
});

export const createMeetingSchema = z.object({
  title: z.string().min(1, '会议主题不能为空'),
  heldAt: z.string().min(1, '召开时间不能为空'),
  participants: z.array(z.string()).optional(),
  agenda: z.array(agendaItemSchema).optional(),
  decisions: z.array(decisionItemSchema).optional(),
  actionItems: z.array(actionItemSchema).optional(),
  relatedProjectId: z.string().nullish(),
});

export const updateMeetingSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  title: z.string().min(1, '会议主题不能为空').optional(),
  heldAt: z.string().min(1, '召开时间不能为空').optional(),
  participants: z.array(z.string()).optional(),
  agenda: z.array(agendaItemSchema).optional(),
  decisions: z.array(decisionItemSchema).optional(),
  actionItems: z.array(actionItemSchema).optional(),
  relatedProjectId: z.string().nullish(),
});

export const listMeetingSchema = z.object({
  relatedProjectId: z.string().nullish(),
  heldAtFrom: z.string().optional(),
  heldAtTo: z.string().optional(),
  keyword: z.string().optional(),
});

export const meetingIdSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});
