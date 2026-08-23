/**
 * 应急响应记录模块 - Service 服务层
 */
import incidentRepository from './incident.repository.js';
import {
  createIncidentSchema,
  updateIncidentSchema,
  listIncidentSchema,
  incidentIdSchema,
  changeIncidentStatusSchema,
  incidentTimelineEntrySchema,
  incidentActionEntrySchema,
} from './incident.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { EMERGENCY_STATUS, EMERGENCY_STATUS_TRANSITIONS, SEVERITY } from '../../common/constants/enums.js';
import { createStateMachine } from '../../lib/stateMachine.js';

class IncidentService {
  /**
   * 新增应急响应记录
   */
  async create(payload) {
    const data = createIncidentSchema.parse(payload);
    const created = await incidentRepository.create({
      title: data.title,
      eventTimeline: data.eventTimeline && data.eventTimeline.length
        ? JSON.stringify(data.eventTimeline) : null,
      responseActions: data.responseActions && data.responseActions.length
        ? JSON.stringify(data.responseActions) : null,
      review: this._nullify(data.review),
      status: data.status || EMERGENCY_STATUS.OPEN,
      severity: data.severity || SEVERITY.MEDIUM,
      sortOrder: data.sortOrder ?? 0,
    });
    return this.toPublic(created);
  }

  /**
   * 编辑应急响应（部分字段更新；状态变更走 changeStatus）
   */
  async update(payload) {
    const parsed = updateIncidentSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await incidentRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '应急记录不存在');
    }
    const updateData = {};
    if ('title' in fields) updateData.title = fields.title;
    if ('review' in fields) updateData.review = this._nullify(fields.review);
    if ('severity' in fields) updateData.severity = fields.severity;
    if ('sortOrder' in fields) updateData.sortOrder = fields.sortOrder;
    const updated = await incidentRepository.updateById(id, updateData);
    return this.toPublic(updated);
  }

  /**
   * 软删除应急响应
   */
  async delete(id) {
    incidentIdSchema.parse({ id });
    const exists = await incidentRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '应急记录不存在');
    }
    await incidentRepository.softDeleteById(id);
    return null;
  }

  /**
   * 根据 ID 获取详情
   */
  async getById(id) {
    incidentIdSchema.parse({ id });
    const r = await incidentRepository.findById(id);
    if (!r) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '应急记录不存在');
    }
    return this.toPublic(r);
  }

  /**
   * 列表查询（支持关键字 / 状态 / 严重度筛选 + 分页 + 排序）
   */
  async list(query = {}) {
    const q = listIncidentSchema.parse(query);
    const result = await incidentRepository.list({
      q: q.q,
      status: q.status,
      severity: q.severity,
      page: q.page,
      limit: q.limit,
      sort: q.sort,
      order: q.order,
    });
    if (Array.isArray(result)) return result.map((r) => this.toPublic(r));
    return { ...result, list: result.list.map((r) => this.toPublic(r)) };
  }

  /**
   * 追加一条时间线条目（先校验单条结构，再合并写回）
   */
  async addTimeline(id, entry) {
    incidentIdSchema.parse({ id });
    const validated = incidentTimelineEntrySchema.parse(entry);
    const exists = await incidentRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '应急记录不存在');
    }
    const arr = this._parseJsonArray(exists.eventTimeline);
    arr.push(validated);
    const updated = await incidentRepository.updateById(id, { eventTimeline: JSON.stringify(arr) });
    return this.toPublic(updated);
  }

  /**
   * 追加一条处置动作条目（先校验单条结构，再合并写回）
   */
  async addActions(id, entry) {
    incidentIdSchema.parse({ id });
    const validated = incidentActionEntrySchema.parse(entry);
    const exists = await incidentRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '应急记录不存在');
    }
    const arr = this._parseJsonArray(exists.responseActions);
    arr.push(validated);
    const updated = await incidentRepository.updateById(id, { responseActions: JSON.stringify(arr) });
    return this.toPublic(updated);
  }

  /**
   * 状态切换（受应急 4 态状态机约束，非法迁移抛 PARAM_ERROR）
   */
  async changeStatus(id, toStatus) {
    incidentIdSchema.parse({ id });
    if (!Object.values(EMERGENCY_STATUS).includes(toStatus)) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, `非法的应急状态「${toStatus}」`);
    }
    const exists = await incidentRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '应急记录不存在');
    }
    const sm = createStateMachine({ name: 'EmergencyStatus', ALLOWED_TRANSITIONS: EMERGENCY_STATUS_TRANSITIONS });
    await sm.transition(exists.status, toStatus);
    const updated = await incidentRepository.updateById(id, { status: toStatus });
    return this.toPublic(updated);
  }

  _nullify(v) {
    if (v === '' || v === undefined || v === null) return null;
    return v;
  }

  _parseJsonArray(str) {
    if (!str) return [];
    try {
      const arr = JSON.parse(str);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  /**
   * 白名单序列化：仅暴露业务字段，绝不外泄 deletedAt
   */
  toPublic(r) {
    if (!r) return r;
    return {
      id: r.id,
      title: r.title,
      eventTimeline: this._parseJsonArray(r.eventTimeline),
      responseActions: this._parseJsonArray(r.responseActions),
      review: r.review,
      status: r.status,
      severity: r.severity,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}

export default new IncidentService();
