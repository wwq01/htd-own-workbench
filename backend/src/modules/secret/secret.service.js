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
    return secretRepository.create({
      name: data.name,
      type: data.type,
      content: data.content,
      usageScenario: this._normalizeText(data.usageScenario),
      remark: this._normalizeText(data.remark),
      expiryDate: this._normalizeText(data.expiryDate),
      sortOrder: data.sortOrder ?? 0,
    });
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

    return secretRepository.updateById(id, updateData);
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
    return item;
  }

  async list(query = {}) {
    const q = listSecretSchema.parse(query);
    return secretRepository.listWithFilters({
      type: q.type,
      keyword: q.keyword,
    });
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
}

export default new SecretService();
