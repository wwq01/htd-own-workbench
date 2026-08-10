/**
 * 代码片段模块 - Service 服务层
 */
import devSnippetRepository from './dev-snippet.repository.js';
import {
  createDevSnippetSchema,
  updateDevSnippetSchema,
  listDevSnippetSchema,
  devSnippetIdSchema,
} from './dev-snippet.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';

class DevSnippetService {
  async create(payload) {
    const data = createDevSnippetSchema.parse(payload);
    return devSnippetRepository.create({
      name: data.name,
      category: data.category || '其他',
      code: data.code,
      remark: this._normalizeText(data.remark),
      sortOrder: data.sortOrder ?? 0,
    });
  }

  async update(payload) {
    const parsed = updateDevSnippetSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await devSnippetRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '代码片段不存在');
    }

    const updateData = {};
    if ('name' in fields) updateData.name = fields.name;
    if ('category' in fields) updateData.category = fields.category;
    if ('code' in fields) updateData.code = fields.code;
    if ('remark' in fields) updateData.remark = this._normalizeText(fields.remark);
    if ('sortOrder' in fields) updateData.sortOrder = fields.sortOrder;

    return devSnippetRepository.updateById(id, updateData);
  }

  async delete(id) {
    devSnippetIdSchema.parse({ id });
    const exists = await devSnippetRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '代码片段不存在');
    }
    return devSnippetRepository.softDeleteById(id);
  }

  async getById(id) {
    devSnippetIdSchema.parse({ id });
    const snippet = await devSnippetRepository.findById(id);
    if (!snippet) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '代码片段不存在');
    }
    return snippet;
  }

  async list(query = {}) {
    const q = listDevSnippetSchema.parse(query);
    return devSnippetRepository.listWithFilters({
      category: q.category,
      keyword: q.keyword,
    });
  }

  async listCategories() {
    return devSnippetRepository.listCategories();
  }

  _normalizeText(value) {
    if (value === '' || value === undefined || value === null) return null;
    return value;
  }
}

export default new DevSnippetService();
