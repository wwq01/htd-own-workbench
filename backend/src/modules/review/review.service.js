/**
 * 复盘模块 - Service 服务层
 */
import reviewRepository from './review.repository.js';
import prisma from '../../database/prisma.js';
import vaultService from '../vault/vault.service.js';
import {
  createReviewSchema,
  updateReviewSchema,
  listReviewSchema,
  reviewIdSchema,
} from './review.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { REVIEW_TYPE, REVIEW_STATUS, REVIEW_STATUS_TRANSITIONS } from '../../common/constants/enums.js';
import { createStateMachine } from '../../lib/stateMachine.js';
import { resolveStateMachine } from '../system/fieldConfig.service.js';
import { getWeekKey, startOfWeek, endOfWeek, formatDate, today } from '../../common/utils/date.js';

class ReviewService {
  async create(payload) {
    const data = createReviewSchema.parse(payload);
    return reviewRepository.create({
      type: data.type,
      weekKey: this._normalizeText(data.weekKey),
      projectId: this._normalizeText(data.projectId),
      highlights: this._normalizeText(data.highlights),
      pitfalls: this._normalizeText(data.pitfalls),
      reusableExperience: this._normalizeText(data.reusableExperience),
      improvements: this._normalizeText(data.improvements),
      customerPainPoints: this._normalizeText(data.customerPainPoints),
      presentationHighlights: this._normalizeText(data.presentationHighlights),
      exposedWeakness: this._normalizeText(data.exposedWeakness),
      reusableTips: this._normalizeText(data.reusableTips),
      reviewResult: this._normalizeText(data.reviewResult),
      remark: this._normalizeText(data.remark),
      sortOrder: data.sortOrder ?? 0,
    });
  }

  /**
   * 推导沉淀来源类型（§6.8.2）
   * 优先用 review.vaultSourceType（会议纪要/项目复盘生成时已写入），
   * 否则按 type 推导：week → WEEKLY_REVIEW，project(含项目) → PROJECT_REVIEW，其余 → MEETING_REVIEW
   */
  _deriveVaultSourceType(review) {
    if (review && review.vaultSourceType) return review.vaultSourceType;
    if (review && review.type === 'week') return 'WEEKLY_REVIEW';
    if (review && review.type === 'project' && review.projectId) return 'PROJECT_REVIEW';
    return 'MEETING_REVIEW';
  }

  /**
   * 推导沉淀草稿标题
   */
  _deriveVaultTitle(review) {
    const base = (review && review.remark) || (review && review.type === 'week' ? '周复盘' : '项目复盘');
    return `${base} → 沉淀草稿（自动生成）`;
  }

  /**
   * 提交复盘：draft → submitted（§6.2.3）
   * 提交后自动生成 Vault 沉淀草稿（§6.8.2）
   */
  async submit(id) {
    reviewIdSchema.parse({ id });
    const exists = await reviewRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '复盘不存在');
    }
    // S1-3：迁移表取自配置平台，未配置/配置非法时回落默认常量
    const { transitions } = await resolveStateMachine('review.status', {
      states: Object.values(REVIEW_STATUS),
      transitions: REVIEW_STATUS_TRANSITIONS,
    });
    const sm = createStateMachine({ name: 'ReviewStatus', ALLOWED_TRANSITIONS: transitions });
    await sm.transition(exists.status, REVIEW_STATUS.SUBMITTED);
    await reviewRepository.updateById(id, { status: REVIEW_STATUS.SUBMITTED });
    const sourceType = this._deriveVaultSourceType(exists);
    const vaultItem = await vaultService.autoCreateFromReview({
      sourceType,
      reviewId: id,
      sourceUrl: `#/review/${id}`,
      title: this._deriveVaultTitle(exists),
    });
    return { id, status: REVIEW_STATUS.SUBMITTED, vaultItem };
  }

  /**
   * 生成沉淀：submitted → precipitated（§6.2.3）
   * 同时将关联的 Vault 沉淀草稿置为 PRECIPITATED（§6.8.2）
   */
  async precipitate(id) {
    reviewIdSchema.parse({ id });
    const exists = await reviewRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '复盘不存在');
    }
    // S1-3：迁移表取自配置平台，未配置/配置非法时回落默认常量
    const { transitions } = await resolveStateMachine('review.status', {
      states: Object.values(REVIEW_STATUS),
      transitions: REVIEW_STATUS_TRANSITIONS,
    });
    const sm = createStateMachine({ name: 'ReviewStatus', ALLOWED_TRANSITIONS: transitions });
    await sm.transition(exists.status, REVIEW_STATUS.PRECIPITATED);
    await reviewRepository.updateById(id, { status: REVIEW_STATUS.PRECIPITATED });
    const sourceType = this._deriveVaultSourceType(exists);
    const vaultItem = await vaultService.markPrecipitatedBySource(sourceType, id);
    return { id, status: REVIEW_STATUS.PRECIPITATED, vaultItem };
  }

  async update(payload) {
    const parsed = updateReviewSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await reviewRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '复盘不存在');
    }

    const updateData = {};
    if ('type' in fields) updateData.type = fields.type;
    if ('weekKey' in fields) updateData.weekKey = this._normalizeText(fields.weekKey);
    if ('projectId' in fields) updateData.projectId = this._normalizeText(fields.projectId);
    if ('highlights' in fields) updateData.highlights = this._normalizeText(fields.highlights);
    if ('pitfalls' in fields) updateData.pitfalls = this._normalizeText(fields.pitfalls);
    if ('reusableExperience' in fields) updateData.reusableExperience = this._normalizeText(fields.reusableExperience);
    if ('improvements' in fields) updateData.improvements = this._normalizeText(fields.improvements);
    if ('customerPainPoints' in fields) updateData.customerPainPoints = this._normalizeText(fields.customerPainPoints);
    if ('presentationHighlights' in fields) updateData.presentationHighlights = this._normalizeText(fields.presentationHighlights);
    if ('exposedWeakness' in fields) updateData.exposedWeakness = this._normalizeText(fields.exposedWeakness);
    if ('reusableTips' in fields) updateData.reusableTips = this._normalizeText(fields.reusableTips);
    if ('reviewResult' in fields) updateData.reviewResult = this._normalizeText(fields.reviewResult);
    if ('remark' in fields) updateData.remark = this._normalizeText(fields.remark);
    if ('sortOrder' in fields) updateData.sortOrder = fields.sortOrder;

    return reviewRepository.updateById(id, updateData);
  }

  async delete(id) {
    reviewIdSchema.parse({ id });
    const exists = await reviewRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '复盘不存在');
    }
    return reviewRepository.softDeleteById(id);
  }

  async getById(id) {
    reviewIdSchema.parse({ id });
    const review = await reviewRepository.findDetailById(id);
    if (!review) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '复盘不存在');
    }
    return this._normalizeAutoData(review);
  }

  async list(query = {}) {
    const q = listReviewSchema.parse(query);
    const list = await reviewRepository.listWithFilters({
      type: q.type,
      weekKey: q.weekKey,
      projectId: q.projectId,
    });
    return list.map(r => this._normalizeAutoData(r));
  }

  /**
   * 创建本周周复盘：自动预填周次标识 + 自动统计数据
   */
  async createCurrentWeek(payload = {}) {
    const weekKey = getWeekKey();
    const existed = await reviewRepository.findCurrentWeek(weekKey);
    if (existed) {
      return { review: existed, created: false };
    }

    // 自动统计本周数据（开发问题数 + 学习时长 + 待办完成率 + 项目进展）
    const weekStart = formatDate(startOfWeek());
    const weekEnd = formatDate(endOfWeek());

    const [weekTodos, weekStudies, weekIssues, activeProjects] = await Promise.all([
      prisma.todo.findMany({
        where: { deletedAt: null, todoDate: { gte: weekStart, lte: weekEnd } },
        select: { status: true },
      }),
      prisma.studyRecord.findMany({
        where: { deletedAt: null, studyDate: { gte: weekStart, lte: weekEnd } },
        select: { duration: true },
      }),
      prisma.devIssue.count({
        where: {
          deletedAt: null,
          updatedAt: { gte: new Date(weekStart), lte: new Date(weekEnd + 'T23:59:59') },
        },
      }),
      prisma.project.findMany({
        where: { deletedAt: null, NOT: { phase: '项目结项' } },
        select: { id: true, customerName: true, phase: true, progress: true },
      }),
    ]);

    const todoTotal = weekTodos.length;
    const todoDone = weekTodos.filter(t => t.status === 'completed').length;
    const studyHours = weekStudies.reduce((s, r) => s + (r.duration || 0), 0);

    const autoData = JSON.stringify({
      weekStart,
      weekEnd,
      weekKey,
      generatedAt: today(),
      todoTotal,
      todoDone,
      todoCompletionRate: todoTotal > 0 ? Math.round((todoDone / todoTotal) * 100) : 0,
      studyHours: parseFloat(studyHours.toFixed(1)),
      issueTouched: weekIssues,
      activeProjects: activeProjects.map(p => ({
        id: p.id, customerName: p.customerName, phase: p.phase, progress: p.progress,
      })),
    });

    const review = await reviewRepository.create({
      type: REVIEW_TYPE.WEEK,
      weekKey,
      autoData,
      vaultSourceType: 'WEEKLY_REVIEW',
      highlights: payload.highlights || null,
      pitfalls: payload.pitfalls || null,
      reusableExperience: payload.reusableExperience || null,
      improvements: payload.improvements || null,
      remark: `本周周复盘（自动生成于 ${today()}）`,
    });

    return { review, created: true };
  }

  _normalizeText(value) {
    if (value === '' || value === undefined || value === null) return null;
    return value;
  }

  _normalizeAutoData(review) {
    if (!review) return review;
    let auto = {};
    try {
      auto = JSON.parse(review.autoData || '{}');
      if (typeof auto !== 'object' || Array.isArray(auto)) auto = {};
    } catch (e) {
      auto = {};
    }
    return { ...review, autoData: auto };
  }
}

export default new ReviewService();
