/**
 * 凭据保险箱模块 - Service 服务层
 */
import secretRepository from './secret.repository.js';
import {
  createSecretSchema,
  updateSecretSchema,
  listSecretSchema,
  secretIdSchema,
} from './secret.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';

class SecretService {
  async create(payload) {
    const data = createSecretSchema.parse(payload);
    return this.toPublic(await secretRepository.create({
      name: data.name,
      type: data.type,
      content: data.content,
      usageScenario: this._normalizeText(data.usageScenario),
      remark: this._normalizeText(data.remark),
      expiryDate: this._normalizeText(data.expiryDate),
      sortOrder: data.sortOrder ?? 0,
    }));
  }

  async update(payload) {
    const parsed = updateSecretSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await secretRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '凭据不存在');
    }

    const updateData = {};
    if ('name' in fields) updateData.name = fields.name;
    if ('type' in fields) updateData.type = fields.type;
    if ('content' in fields) updateData.content = fields.content;
    if ('usageScenario' in fields) updateData.usageScenario = this._normalizeText(fields.usageScenario);
    if ('remark' in fields) updateData.remark = this._normalizeText(fields.remark);
    if ('expiryDate' in fields) updateData.expiryDate = this._normalizeText(fields.expiryDate);
    if ('sortOrder' in fields) updateData.sortOrder = fields.sortOrder;

    return this.toPublic(await secretRepository.updateById(id, updateData));
  }

  async delete(id) {
    secretIdSchema.parse({ id });
    const exists = await secretRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '凭据不存在');
    }
    return secretRepository.softDeleteById(id);
  }

  async getById(id) {
    secretIdSchema.parse({ id });
    const item = await secretRepository.findById(id);
    if (!item) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '凭据不存在');
    }
    return this.toPublic(item);
  }

  async list(query = {}) {
    const q = listSecretSchema.parse(query);
    const rows = await secretRepository.listWithFilters({
      type: q.type,
      keyword: q.keyword,
    });
    return rows.map((item) => this.toPublic(item));
  }

  /**
   * 各类型数量统计
   */
  async getTypeStats() {
    return secretRepository.countByType();
  }

  _normalizeText(value) {
    if (value === '' || value === undefined || value === null) return null;
    return value;
  }

  /**
   * 字段白名单序列化：仅对外暴露安全字段。
   * 注意：content 为凭据明文，本地单用户场景下前端需展示/复制，故予以保留；
   * 白名单的意义在于——未来模型新增敏感列时不会被自动泄露。
   */
  toPublic(item) {
    if (!item) return item;
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      content: item.content,
      usageScenario: item.usageScenario,
      remark: item.remark,
      expiryDate: item.expiryDate,
      sortOrder: item.sortOrder,
      deletedAt: item.deletedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}

export default new SecretService();
