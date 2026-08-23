/**
 * 投标档案模块 - Service 服务层
 */
import bidRepository from './bid.repository.js';
import {
  createBidSchema,
  updateBidSchema,
  listBidSchema,
  bidIdSchema,
  changeBidStatusSchema,
} from './bid.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { BID_STATUS, BID_STATUS_TRANSITIONS, BID_RESULT } from '../../common/constants/enums.js';
import { createStateMachine } from '../../lib/stateMachine.js';

class BidService {
  /**
   * 新增投标档案
   */
  async create(payload) {
    const data = createBidSchema.parse(payload);
    const created = await bidRepository.create({
      bidNo: data.bidNo,
      deadline: this._nullify(data.deadline),
      bidVersion: this._nullify(data.bidVersion),
      bidResult: data.bidResult || BID_RESULT.PENDING,
      status: data.status || BID_STATUS.DRAFT,
      projectMilestoneId: this._nullify(data.projectMilestoneId),
      sortOrder: data.sortOrder ?? 0,
    });
    return this.toPublic(created);
  }

  /**
   * 编辑投标档案（部分字段更新；状态变更走 changeStatus）
   */
  async update(payload) {
    const parsed = updateBidSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await bidRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '投标档案不存在');
    }
    const updateData = {};
    if ('bidNo' in fields) updateData.bidNo = fields.bidNo;
    if ('deadline' in fields) updateData.deadline = this._nullify(fields.deadline);
    if ('bidVersion' in fields) updateData.bidVersion = this._nullify(fields.bidVersion);
    if ('bidResult' in fields) updateData.bidResult = fields.bidResult;
    if ('projectMilestoneId' in fields) updateData.projectMilestoneId = this._nullify(fields.projectMilestoneId);
    if ('sortOrder' in fields) updateData.sortOrder = fields.sortOrder;
    const updated = await bidRepository.updateById(id, updateData);
    return this.toPublic(updated);
  }

  /**
   * 软删除投标档案
   */
  async delete(id) {
    bidIdSchema.parse({ id });
    const exists = await bidRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '投标档案不存在');
    }
    await bidRepository.softDeleteById(id);
    return null;
  }

  /**
   * 根据 ID 获取详情
   */
  async getById(id) {
    bidIdSchema.parse({ id });
    const r = await bidRepository.findById(id);
    if (!r) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '投标档案不存在');
    }
    return this.toPublic(r);
  }

  /**
   * 列表查询（支持关键字 / 状态 / 结果 / 里程碑软关联筛选 + 分页 + 排序）
   */
  async list(query = {}) {
    const q = listBidSchema.parse(query);
    const result = await bidRepository.list({
      q: q.q,
      status: q.status,
      bidResult: q.bidResult,
      projectMilestoneId: q.milestoneId,
      page: q.page,
      limit: q.limit,
      sort: q.sort,
      order: q.order,
    });
    if (Array.isArray(result)) return result.map((r) => this.toPublic(r));
    return { ...result, list: result.list.map((r) => this.toPublic(r)) };
  }

  /**
   * 状态切换（受投标 3 态状态机约束，非法迁移抛 PARAM_ERROR）
   */
  async changeStatus(id, toStatus) {
    bidIdSchema.parse({ id });
    if (!Object.values(BID_STATUS).includes(toStatus)) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, `非法的投标状态「${toStatus}」`);
    }
    const exists = await bidRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '投标档案不存在');
    }
    const sm = createStateMachine({ name: 'BidStatus', ALLOWED_TRANSITIONS: BID_STATUS_TRANSITIONS });
    await sm.transition(exists.status, toStatus);
    const updated = await bidRepository.updateById(id, { status: toStatus });
    return this.toPublic(updated);
  }

  _nullify(v) {
    if (v === '' || v === undefined || v === null) return null;
    return v;
  }

  /**
   * 白名单序列化：仅暴露业务字段，绝不外泄 deletedAt
   */
  toPublic(r) {
    if (!r) return r;
    return {
      id: r.id,
      bidNo: r.bidNo,
      deadline: r.deadline,
      bidVersion: r.bidVersion,
      bidResult: r.bidResult,
      status: r.status,
      projectMilestoneId: r.projectMilestoneId,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}

export default new BidService();
