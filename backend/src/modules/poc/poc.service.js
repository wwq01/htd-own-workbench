/**
 * POC 跟踪模块 - Service 服务层
 */
import pocRepository from './poc.repository.js';
import {
  createPocSchema,
  updatePocSchema,
  listPocSchema,
  pocIdSchema,
  changePocStatusSchema,
} from './poc.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { POC_STATUS, POC_STATUS_TRANSITIONS } from '../../common/constants/enums.js';
import { createStateMachine } from '../../lib/stateMachine.js';

class PocService {
  /**
   * 新增 POC 跟踪
   */
  async create(payload) {
    const data = createPocSchema.parse(payload);
    const created = await pocRepository.create({
      goal: data.goal,
      environment: this._nullify(data.environment),
      customerParticipants: data.customerParticipants ? JSON.stringify(data.customerParticipants) : null,
      result: this._nullify(data.result),
      status: data.status || POC_STATUS.DRAFT,
      projectId: this._nullify(data.projectId),
      sortOrder: data.sortOrder ?? 0,
    });
    return this.toPublic(created);
  }

  /**
   * 编辑 POC（部分字段更新；状态变更走 changeStatus）
   */
  async update(payload) {
    const parsed = updatePocSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await pocRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, 'POC 不存在');
    }
    const updateData = {};
    if ('goal' in fields) updateData.goal = fields.goal;
    if ('environment' in fields) updateData.environment = this._nullify(fields.environment);
    if ('customerParticipants' in fields) {
      updateData.customerParticipants = fields.customerParticipants ? JSON.stringify(fields.customerParticipants) : null;
    }
    if ('result' in fields) updateData.result = this._nullify(fields.result);
    if ('projectId' in fields) updateData.projectId = this._nullify(fields.projectId);
    if ('sortOrder' in fields) updateData.sortOrder = fields.sortOrder;
    const updated = await pocRepository.updateById(id, updateData);
    return this.toPublic(updated);
  }

  /**
   * 软删除 POC
   */
  async delete(id) {
    pocIdSchema.parse({ id });
    const exists = await pocRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, 'POC 不存在');
    }
    await pocRepository.softDeleteById(id);
    return null;
  }

  /**
   * 根据 ID 获取详情
   */
  async getById(id) {
    pocIdSchema.parse({ id });
    const r = await pocRepository.findById(id);
    if (!r) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, 'POC 不存在');
    }
    return this.toPublic(r);
  }

  /**
   * 列表查询（支持关键字 / 状态 / 项目筛选 + 分页 + 排序）
   */
  async list(query = {}) {
    const q = listPocSchema.parse(query);
    const result = await pocRepository.list({
      q: q.q,
      status: q.status,
      projectId: q.projectId,
      page: q.page,
      limit: q.limit,
      sort: q.sort,
      order: q.order,
    });
    if (Array.isArray(result)) return result.map((r) => this.toPublic(r));
    return { ...result, list: result.list.map((r) => this.toPublic(r)) };
  }

  /**
   * 状态切换（受 POC 6 态状态机约束，非法迁移抛 PARAM_ERROR）
   */
  async changeStatus(id, toStatus) {
    pocIdSchema.parse({ id });
    if (!Object.values(POC_STATUS).includes(toStatus)) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, `非法的 POC 状态「${toStatus}」`);
    }
    const exists = await pocRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, 'POC 不存在');
    }
    const sm = createStateMachine({ name: 'PocStatus', ALLOWED_TRANSITIONS: POC_STATUS_TRANSITIONS });
    await sm.transition(exists.status, toStatus);
    const updated = await pocRepository.updateById(id, { status: toStatus });
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
      goal: r.goal,
      environment: r.environment,
      customerParticipants: this._parseJsonArray(r.customerParticipants),
      result: r.result,
      status: r.status,
      projectId: r.projectId,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}

export default new PocService();
