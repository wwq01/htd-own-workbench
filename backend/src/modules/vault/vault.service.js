/**
 * 沉淀模块 - Service 服务层
 */
import vaultRepository from './vault.repository.js';
import {
  createVaultSchema,
  updateVaultSchema,
  listVaultSchema,
  vaultIdSchema,
} from './vault.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';

class VaultService {
  /**
   * 列表查询（支持 status / sourceType / tag 筛选）
   * orderBy updatedAt desc
   */
  async list(query = {}) {
    const q = listVaultSchema.parse(query);
    const where = {};
    if (q.status) where.status = q.status;
    if (q.sourceType) where.sourceType = q.sourceType;
    // tags 以 JSON 字符串存储，使用 contains 做子串匹配
    if (q.tag) where.tags = { contains: q.tag };

    return vaultRepository.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * 根据 ID 获取详情
   */
  async getById(id) {
    vaultIdSchema.parse({ id });
    const item = await vaultRepository.findById(id);
    if (!item) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '沉淀项不存在');
    }
    return item;
  }

  /**
   * 新增沉淀
   */
  async create(payload) {
    // 显式校验主题非空（BusinessError PARAM_ERROR）
    if (!payload || !payload.topic || !String(payload.topic).trim()) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, '沉淀主题不能为空');
    }
    const data = createVaultSchema.parse(payload);
    return vaultRepository.create({
      topic: data.topic,
      content: data.content || '',
      tags: data.tags && data.tags.length ? JSON.stringify(data.tags) : '[]',
      status: data.status || 'DRAFT',
      sourceType: data.sourceType || 'MANUAL',
      sourceId: data.sourceId || null,
      sourceUrl: data.sourceUrl || null,
    });
  }

  /**
   * 由复盘提交自动生成沉淀草稿（§6.8.2）
   * 幂等：同一来源（sourceType + sourceId）已生成过则直接返回，不重复创建。
   * 仅生成「摘要 + 引用指针」，不复制复盘原文（§6.8.4 引用不复制原则）。
   */
  async autoCreateFromReview({ sourceType, reviewId, sourceUrl, title, content }) {
    const existed = await vaultRepository.findOne({ sourceType, sourceId: reviewId });
    if (existed) return existed;
    return this.create({
      topic: title || '复盘沉淀草稿',
      content: content || '',
      tags: [],
      status: 'DRAFT',
      sourceType,
      sourceId: reviewId,
      sourceUrl: sourceUrl || null,
    });
  }

  /**
   * 将某来源的沉淀草稿置为 PRECIPITATED（复盘提交沉淀时调用，§6.2.3 / §6.8.2）
   */
  async markPrecipitatedBySource(sourceType, reviewId) {
    const item = await vaultRepository.findOne({ sourceType, sourceId: reviewId });
    if (!item) return null;
    return this.update(item.id, { status: 'PRECIPITATED' });
  }

  /**
   * 编辑沉淀（部分字段更新）
   */
  async update(id, payload) {
    const parsed = updateVaultSchema.parse({ id, ...payload });
    const { id: _id, ...fields } = parsed;
    const exists = await vaultRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '沉淀项不存在');
    }

    const updateData = { ...fields };
    // tags 以 JSON 字符串存储，存在时重新序列化
    if ('tags' in updateData) {
      updateData.tags = Array.isArray(updateData.tags) && updateData.tags.length
        ? JSON.stringify(updateData.tags)
        : '[]';
    }
    // 空字符串来源字段处理为 null
    if ('sourceId' in updateData && updateData.sourceId === '') updateData.sourceId = null;
    if ('sourceUrl' in updateData && updateData.sourceUrl === '') updateData.sourceUrl = null;

    return vaultRepository.updateById(id, updateData);
  }

  /**
   * 软删除沉淀
   */
  async delete(id) {
    vaultIdSchema.parse({ id });
    const exists = await vaultRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '沉淀项不存在');
    }
    return vaultRepository.softDeleteById(id);
  }
}

export default new VaultService();
