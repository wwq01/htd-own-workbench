/**
 * S2-5 RFP 条目级应答模块 - Service 服务层
 *
 * 设计要点：
 * - 软关联：bidId 仅存投标档案 id，无外键/级联，投标归档后条目仍可追溯；
 * - 双轴：responseType（应答类型：完全响应/部分响应/偏离/不响应/优于）与
 *   status（应答进度：todo/doing/done）分离，兼顾「应答质量」与「应答进度」；
 * - 证据挂载：evidence 以 JSON 数组存储 [{ sourceType, sourceId, label }]，
 *   通用软关联引用 Vault / POC / 漏洞 / 会议 / 笔记 / 合同 / 交付等既有记录。
 */
import rfpItemRepository from './rfp.repository.js';
import {
  createRfpItemSchema,
  updateRfpItemSchema,
  listRfpItemSchema,
  rfpItemIdSchema,
  changeRfpItemStatusSchema,
  rfpStatsSchema,
} from './rfp.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import {
  RFP_RESPONSE_TYPE,
  RFP_ITEM_STATUS,
  RFP_ITEM_STATUS_TRANSITIONS,
} from '../../common/constants/enums.js';
import { createStateMachine } from '../../lib/stateMachine.js';

class RfpItemService {
  /**
   * 列表查询（按投标 / 状态 / 应答类型筛选 + 关键字 + 分页 + 排序）
   */
  async list(query = {}) {
    const q = listRfpItemSchema.parse(query);
    const result = await rfpItemRepository.list({
      bidId: q.bidId,
      q: q.q,
      status: q.status,
      responseType: q.responseType,
      sort: q.sort,
      order: q.order,
      page: q.page,
      limit: q.limit,
    });
    if (Array.isArray(result)) return result.map((r) => this.toPublic(r));
    return { ...result, list: result.list.map((r) => this.toPublic(r)) };
  }

  /**
   * 根据 ID 获取详情
   */
  async getById(id) {
    rfpItemIdSchema.parse({ id });
    const item = await rfpItemRepository.findById(id);
    if (!item) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, 'RFP 条目不存在');
    }
    return this.toPublic(item);
  }

  /**
   * 新增 RFP 条目
   */
  async create(payload) {
    const data = createRfpItemSchema.parse(payload);
    return this.toPublic(
      await rfpItemRepository.create({
        bidId: data.bidId,
        code: this._nullify(data.code),
        title: data.title,
        requirement: this._nullify(data.requirement),
        response: this._nullify(data.response),
        responseType: data.responseType || RFP_RESPONSE_TYPE.PENDING,
        status: data.status || RFP_ITEM_STATUS.TODO,
        owner: this._nullify(data.owner),
        evidence: this._serializeEvidence(data.evidence),
        remark: this._nullify(data.remark),
        sortOrder: data.sortOrder ?? 0,
      })
    );
  }

  /**
   * 编辑 RFP 条目（部分字段更新；进度状态变更走 changeStatus）
   */
  async update(id, payload) {
    const parsed = updateRfpItemSchema.parse({ id, ...payload });
    const exists = await rfpItemRepository.findById(parsed.id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, 'RFP 条目不存在');
    }
    const { id: _id, ...fields } = parsed;
    const updateData = {};
    const textFields = ['code', 'requirement', 'response', 'owner', 'remark'];
    textFields.forEach((f) => {
      if (f in fields) updateData[f] = this._nullify(fields[f]);
    });
    if ('title' in fields) updateData.title = fields.title;
    if ('responseType' in fields) updateData.responseType = fields.responseType;
    if ('sortOrder' in fields) updateData.sortOrder = fields.sortOrder;
    if ('evidence' in fields) updateData.evidence = this._serializeEvidence(fields.evidence);
    // status 允许随表单提交，但必须受状态机约束
    if ('status' in fields && fields.status !== exists.status) {
      const sm = createStateMachine({
        name: 'RfpItemStatus',
        ALLOWED_TRANSITIONS: RFP_ITEM_STATUS_TRANSITIONS,
      });
      await sm.transition(exists.status, fields.status);
      updateData.status = fields.status;
    }
    if (Object.keys(updateData).length === 0) return this.toPublic(exists);
    return this.toPublic(await rfpItemRepository.updateById(parsed.id, updateData));
  }

  /**
   * 软删除 RFP 条目
   */
  async delete(id) {
    rfpItemIdSchema.parse({ id });
    const exists = await rfpItemRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, 'RFP 条目不存在');
    }
    await rfpItemRepository.softDeleteById(id);
    return null;
  }

  /**
   * 应答进度切换（受 RFP 条目 3 态状态机约束，非法迁移抛 PARAM_ERROR）
   */
  async changeStatus(id, toStatus) {
    rfpItemIdSchema.parse({ id });
    if (!Object.values(RFP_ITEM_STATUS).includes(toStatus)) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, `非法的 RFP 条目状态「${toStatus}」`);
    }
    const exists = await rfpItemRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, 'RFP 条目不存在');
    }
    const sm = createStateMachine({
      name: 'RfpItemStatus',
      ALLOWED_TRANSITIONS: RFP_ITEM_STATUS_TRANSITIONS,
    });
    await sm.transition(exists.status, toStatus);
    return this.toPublic(await rfpItemRepository.updateById(id, { status: toStatus }));
  }

  /**
   * 投标应答进度聚合（进度条 / 统计卡片数据源）
   * 返回：总数、按进度、按应答类型、已应答数、完成率、证据总数
   */
  async stats(bidId) {
    const { bidId: bid } = rfpStatsSchema.parse({ bidId });
    const byStatus = {};
    await Promise.all(
      Object.values(RFP_ITEM_STATUS).map(async (s) => {
        byStatus[s] = await rfpItemRepository.count({ bidId: bid, status: s });
      })
    );
    const byResponseType = {};
    await Promise.all(
      Object.values(RFP_RESPONSE_TYPE).map(async (t) => {
        byResponseType[t] = await rfpItemRepository.count({ bidId: bid, responseType: t });
      })
    );
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const done = byStatus[RFP_ITEM_STATUS.DONE] || 0;
    const pending = byResponseType[RFP_RESPONSE_TYPE.PENDING] || 0;
    const items = await rfpItemRepository.findMany({
      where: { bidId: bid },
      orderBy: { sortOrder: 'asc' },
    });
    const evidenceCount = items.reduce((sum, it) => sum + this._parseEvidence(it.evidence).length, 0);
    return {
      bidId: bid,
      total,
      byStatus,
      byResponseType,
      answered: total - pending,
      pendingCount: pending,
      evidenceCount,
      // 完成率基于「进度已完成」占比；0 条目时返回 0 而非 NaN
      progress: total ? Math.round((done / total) * 100) : 0,
    };
  }

  _nullify(v) {
    if (v === '' || v === undefined || v === null) return null;
    return v;
  }

  _serializeEvidence(ev) {
    if (!Array.isArray(ev) || ev.length === 0) return '[]';
    return JSON.stringify(ev);
  }

  _parseEvidence(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * 白名单序列化：仅暴露业务字段，绝不外泄 deletedAt；evidence 反序列化为数组
   */
  toPublic(r) {
    if (!r) return r;
    return {
      id: r.id,
      bidId: r.bidId,
      code: r.code,
      title: r.title,
      requirement: r.requirement,
      response: r.response,
      responseType: r.responseType,
      status: r.status,
      owner: r.owner,
      evidence: this._parseEvidence(r.evidence),
      remark: r.remark,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}

export default new RfpItemService();
