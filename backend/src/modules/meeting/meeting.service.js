/**
 * 会议模块 - Service 服务层
 */
import meetingRepository from './meeting.repository.js';
import {
  createMeetingSchema,
  updateMeetingSchema,
  listMeetingSchema,
  meetingIdSchema,
} from './meeting.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import prisma from '../../database/prisma.js';

class MeetingService {
  /**
   * 列表查询（支持筛选）
   */
  async list(query = {}) {
    const q = listMeetingSchema.parse(query);
    return meetingRepository.listByFilter({
      relatedProjectId: q.relatedProjectId || undefined,
      heldAtFrom: q.heldAtFrom || undefined,
      heldAtTo: q.heldAtTo || undefined,
      keyword: q.keyword || undefined,
    });
  }

  /**
   * 根据 ID 获取详情
   */
  async getById(id) {
    meetingIdSchema.parse({ id });
    const meeting = await meetingRepository.findById(id);
    if (!meeting) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '会议不存在');
    }
    return meeting;
  }

  /**
   * 新增会议
   */
  async create(payload) {
    const data = createMeetingSchema.parse(payload);

    if (!data.title || !data.heldAt) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, '会议主题与召开时间不能为空');
    }

    return meetingRepository.create({
      title: data.title,
      heldAt: new Date(data.heldAt),
      participants: JSON.stringify(data.participants || []),
      agenda: JSON.stringify(data.agenda || []),
      decisions: JSON.stringify(data.decisions || []),
      actionItems: JSON.stringify(data.actionItems || []),
      relatedProjectId: data.relatedProjectId || null,
    });
  }

  /**
   * 编辑会议（部分字段更新）
   */
  async update(payload) {
    const parsed = updateMeetingSchema.parse(payload);
    const { id, ...fields } = parsed;

    const exists = await meetingRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '会议不存在');
    }

    const updateData = {};
    if ('title' in fields && fields.title !== undefined) updateData.title = fields.title;
    if ('heldAt' in fields && fields.heldAt !== undefined) updateData.heldAt = new Date(fields.heldAt);
    if ('participants' in fields) updateData.participants = JSON.stringify(fields.participants || []);
    if ('agenda' in fields) updateData.agenda = JSON.stringify(fields.agenda || []);
    if ('decisions' in fields) updateData.decisions = JSON.stringify(fields.decisions || []);
    if ('actionItems' in fields) updateData.actionItems = JSON.stringify(fields.actionItems || []);
    if ('relatedProjectId' in fields) updateData.relatedProjectId = fields.relatedProjectId || null;

    return meetingRepository.updateById(id, updateData);
  }

  /**
   * 软删除会议
   */
  async delete(id) {
    meetingIdSchema.parse({ id });
    const exists = await meetingRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '会议不存在');
    }
    return meetingRepository.softDeleteById(id);
  }

  /**
   * 生成会议复盘草稿
   * 将会议的决策与行动项汇总为 Markdown，写入一条 project 类型复盘（draft），
   * 并把该复盘 ID 回写会议记录。
   */
  async generateReview(id) {
    meetingIdSchema.parse({ id });
    const meeting = await meetingRepository.findById(id);
    if (!meeting) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '会议不存在');
    }

    let decisions = [];
    let actionItems = [];
    try { decisions = JSON.parse(meeting.decisions || '[]'); } catch (e) { decisions = []; }
    try { actionItems = JSON.parse(meeting.actionItems || '[]'); } catch (e) { actionItems = []; }

    const decisionLines = decisions.length
      ? decisions.map(d => `- ${d.content || ''} (${d.owner || ''})`).join('\n')
      : '- （无）';
    const actionLines = actionItems.length
      ? actionItems.map(a => `- [${a.done ? 'x' : ' '}] ${a.content || ''}${a.owner ? `（负责人：${a.owner}）` : ''}`).join('\n')
      : '- （无）';

    const markdown =
      `## 核心决策\n${decisionLines}\n\n` +
      `## 行动项\n${actionLines}`;

    const review = await prisma.review.create({
      data: {
        type: 'project',
        highlights: markdown,
        status: 'draft',
        vaultSourceType: 'MEETING_REVIEW',
        autoData: '{}',
        remark: `【会议复盘】${meeting.title}`,
      },
    });

    await prisma.meeting.update({
      where: { id },
      data: { reviewId: review.id },
    });

    return review;
  }
}

export default new MeetingService();
