/**
 * 阅读 / 资料模块 - Service 服务层
 */
import readingRepository from './reading.repository.js';
import vaultService from '../vault/vault.service.js';
import {
  createReadingSchema,
  updateReadingSchema,
  listReadingSchema,
  readingIdSchema,
  changeReadingStatusSchema,
} from './reading.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { READING_STATUS, READING_STATUS_TRANSITIONS, READING_TYPE } from '../../common/constants/enums.js';
import { createStateMachine } from '../../lib/stateMachine.js';
import { parseFieldsParam, pickFields } from '../../lib/fieldSelector.js';
import {
  ensureFieldConfigCache,
  resolveStateMachine,
} from '../system/fieldConfig.service.js';

function parseJsonArray(str, fallback = []) {
  if (!str) return fallback;
  try {
    const v = JSON.parse(str);
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonObject(str, fallback = {}) {
  if (!str) return fallback;
  try {
    const v = JSON.parse(str);
    return v && typeof v === 'object' ? v : fallback;
  } catch {
    return fallback;
  }
}

class ReadingService {
  /**
   * 新增阅读资料
   */
  async create(payload) {
    await ensureFieldConfigCache();
    const data = createReadingSchema.parse(payload);
    const created = await readingRepository.create({
      title: data.title,
      sourceUrl: this._nullify(data.sourceUrl),
      type: data.type || READING_TYPE.ARTICLE,
      tags: data.tags && data.tags.length ? JSON.stringify(data.tags) : '[]',
      readingStatus: data.readingStatus || READING_STATUS.UNREAD,
      notes: this._nullify(data.notes),
      customFields: data.customFields ? JSON.stringify(data.customFields) : '{}',
      sortOrder: data.sortOrder ?? 0,
    });
    return this.toPublic(created);
  }

  /**
   * 编辑阅读资料（部分字段更新；阅读状态变更走 changeStatus）
   */
  async update(payload) {
    await ensureFieldConfigCache();
    const parsed = updateReadingSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await readingRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '阅读项不存在');
    }
    const updateData = {};
    if ('title' in fields) updateData.title = fields.title;
    if ('sourceUrl' in fields) updateData.sourceUrl = this._nullify(fields.sourceUrl);
    if ('type' in fields) updateData.type = fields.type;
    if ('tags' in fields) updateData.tags = fields.tags && fields.tags.length ? JSON.stringify(fields.tags) : '[]';
    if ('notes' in fields) updateData.notes = this._nullify(fields.notes);
    if ('customFields' in fields) updateData.customFields = fields.customFields ? JSON.stringify(fields.customFields) : '{}';
    if ('readingStatus' in fields) updateData.readingStatus = fields.readingStatus;
    if ('sortOrder' in fields) updateData.sortOrder = fields.sortOrder;
    const updated = await readingRepository.updateById(id, updateData);
    return this.toPublic(updated);
  }

  /**
   * 软删除阅读资料
   */
  async delete(id) {
    readingIdSchema.parse({ id });
    const exists = await readingRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '阅读项不存在');
    }
    await readingRepository.softDeleteById(id);
    return null;
  }

  /**
   * 根据 ID 获取详情
   */
  async getById(id) {
    readingIdSchema.parse({ id });
    const r = await readingRepository.findById(id);
    if (!r) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '阅读项不存在');
    }
    return this.toPublic(r);
  }

  /**
   * 列表查询（支持类型 / 状态 / 标签 / 关键词筛选 + V1.5 ?fields 裁剪）
   */
  async list(query = {}) {
    await ensureFieldConfigCache();
    const q = listReadingSchema.parse(query);
    const result = await readingRepository.list({
      q: q.q,
      type: q.type,
      readingStatus: q.readingStatus,
      tags: q.tags,
      page: q.page,
      limit: q.limit,
      sort: q.sort,
      order: q.order,
    });
    const fields = parseFieldsParam(q.fields);
    if (Array.isArray(result)) {
      const list = result.map((r) => this.toPublic(r));
      return fields ? pickFields(list, fields) : list;
    }
    const list = result.list.map((r) => this.toPublic(r));
    return { ...result, list: fields ? pickFields(list, fields) : list };
  }

  /**
   * 阅读状态切换（受阅读 4 态状态机约束，非法迁移抛 PARAM_ERROR）
   */
  async changeStatus(id, toStatus) {
    readingIdSchema.parse({ id });
    // S1-3：迁移表取自配置平台，未配置/配置非法时回落默认常量
    const { states, transitions } = await resolveStateMachine('reading.status', {
      states: Object.values(READING_STATUS),
      transitions: READING_STATUS_TRANSITIONS,
    });
    if (!states.includes(toStatus)) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, `非法的阅读状态「${toStatus}」`);
    }
    const exists = await readingRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '阅读项不存在');
    }
    const sm = createStateMachine({ name: 'ReadingStatus', ALLOWED_TRANSITIONS: transitions });
    await sm.transition(exists.readingStatus, toStatus);
    const updated = await readingRepository.updateById(id, { readingStatus: toStatus });
    return this.toPublic(updated);
  }

  /**
   * 一键转化为 Vault 沉淀（V1.5 阅读→沉淀通路）
   * 幂等：同一阅读项已沉淀过则直接返回既有 Vault 条目。
   */
  async convertToVault(id) {
    readingIdSchema.parse({ id });
    const r = await readingRepository.findById(id);
    if (!r) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '阅读项不存在');
    }
    const vaultItem = await vaultService.upsertFromSource({
      sourceType: 'READING_NOTE',
      sourceId: id,
      title: r.title,
      content: r.notes || '',
      tags: parseJsonArray(r.tags),
    });
    return {
      id: vaultItem.id,
      topic: vaultItem.topic,
      sourceType: vaultItem.sourceType,
      sourceId: vaultItem.sourceId,
    };
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
      title: r.title,
      sourceUrl: r.sourceUrl,
      type: r.type,
      tags: parseJsonArray(r.tags),
      readingStatus: r.readingStatus,
      notes: r.notes,
      customFields: parseJsonObject(r.customFields),
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}

export default new ReadingService();
