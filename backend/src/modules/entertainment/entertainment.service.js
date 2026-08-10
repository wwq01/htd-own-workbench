/**
 * 娱乐内容模块 - Service 服务层
 */
import entertainmentRepository from './entertainment.repository.js';
import {
  createEntertainmentSchema,
  updateEntertainmentSchema,
  listEntertainmentSchema,
  entertainmentIdSchema,
} from './entertainment.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';

class EntertainmentService {
  async create(payload) {
    const data = createEntertainmentSchema.parse(payload);
    return entertainmentRepository.create({
      name: data.name,
      type: data.type,
      status: data.status,
      rating: data.rating ?? 0,
      progress: this._normalizeText(data.progress),
      review: this._normalizeText(data.review),
      sortOrder: data.sortOrder ?? 0,
    });
  }

  async update(payload) {
    const parsed = updateEntertainmentSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await entertainmentRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '娱乐内容不存在');
    }

    const updateData = {};
    if ('name' in fields) updateData.name = fields.name;
    if ('type' in fields) updateData.type = fields.type;
    if ('status' in fields) updateData.status = fields.status;
    if ('rating' in fields) updateData.rating = fields.rating;
    if ('progress' in fields) updateData.progress = this._normalizeText(fields.progress);
    if ('review' in fields) updateData.review = this._normalizeText(fields.review);
    if ('sortOrder' in fields) updateData.sortOrder = fields.sortOrder;

    return entertainmentRepository.updateById(id, updateData);
  }

  async delete(id) {
    entertainmentIdSchema.parse({ id });
    const exists = await entertainmentRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '娱乐内容不存在');
    }
    return entertainmentRepository.softDeleteById(id);
  }

  async getById(id) {
    entertainmentIdSchema.parse({ id });
    const item = await entertainmentRepository.findById(id);
    if (!item) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '娱乐内容不存在');
    }
    return item;
  }

  async list(query = {}) {
    const q = listEntertainmentSchema.parse(query);
    return entertainmentRepository.listWithFilters({
      type: q.type,
      status: q.status,
      keyword: q.keyword,
    });
  }

  /**
   * 随机推荐一条「想看/在玩」作品
   */
  async recommendOne() {
    return entertainmentRepository.pickRandomActive();
  }

  /**
   * 各状态数量统计
   */
  async getStatusStats() {
    return entertainmentRepository.countByStatus();
  }

  _normalizeText(value) {
    if (value === '' || value === undefined || value === null) return null;
    return value;
  }
}

export default new EntertainmentService();
