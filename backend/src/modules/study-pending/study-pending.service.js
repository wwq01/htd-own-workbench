/**
 * 待学清单模块 - Service 服务层
 */
import studyPendingRepository from './study-pending.repository.js';
import prisma from '../../database/prisma.js';
import {
  createStudyPendingSchema,
  updateStudyPendingSchema,
  listStudyPendingSchema,
  studyPendingIdSchema,
  completeStudyPendingSchema,
} from './study-pending.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { today } from '../../common/utils/date.js';

class StudyPendingService {
  async create(payload) {
    const data = createStudyPendingSchema.parse(payload);
    return studyPendingRepository.create({
      resourceType: this._normalizeText(data.resourceType),
      title: data.title,
      sourceLink: this._normalizeText(data.sourceLink),
      remark: this._normalizeText(data.remark),
      completed: false,
      sortOrder: data.sortOrder ?? 0,
    });
  }

  async update(payload) {
    const parsed = updateStudyPendingSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await studyPendingRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '待学清单不存在');
    }

    const updateData = {};
    if ('resourceType' in fields) updateData.resourceType = this._normalizeText(fields.resourceType);
    if ('title' in fields) updateData.title = fields.title;
    if ('sourceLink' in fields) updateData.sourceLink = this._normalizeText(fields.sourceLink);
    if ('remark' in fields) updateData.remark = this._normalizeText(fields.remark);
    if ('sortOrder' in fields) updateData.sortOrder = fields.sortOrder;

    return studyPendingRepository.updateById(id, updateData);
  }

  async delete(id) {
    studyPendingIdSchema.parse({ id });
    const exists = await studyPendingRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '待学清单不存在');
    }
    return studyPendingRepository.softDeleteById(id);
  }

  async getById(id) {
    studyPendingIdSchema.parse({ id });
    const item = await studyPendingRepository.findById(id);
    if (!item) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '待学清单不存在');
    }
    return item;
  }

  async list(query = {}) {
    const q = listStudyPendingSchema.parse(query);
    return studyPendingRepository.listWithFilters({
      completed: q.completed,
    });
  }

  /**
   * 标记已学习 → 自动转为学习记录
   * 信息映射：title → topic, sourceLink → source, resourceType → techDirection
   * 返回 { pending, record }
   */
  async completeAndConvert(payload) {
    const data = completeStudyPendingSchema.parse(payload);
    const { id, ...recordFields } = data;

    const pending = await studyPendingRepository.findById(id);
    if (!pending) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '待学清单不存在');
    }

    if (pending.completed) {
      throw new BusinessError(ErrorCodes.BUSINESS_ERROR, '该资源已标记为已学习');
    }

    // 1. 标记待学清单为已完成
    const updatedPending = await studyPendingRepository.updateById(id, { completed: true });

    // 2. 自动创建学习记录，预填字段（信息无丢失）
    const record = await prisma.studyRecord.create({
      data: {
        type: recordFields.type || '专业学习',
        techDirection: this._normalizeText(recordFields.techDirection) || pending.resourceType || null,
        topic: pending.title,
        notes: this._normalizeText(recordFields.notes),
        source: pending.sourceLink || pending.resourceType || null,
        duration: recordFields.duration || 0,
        studyDate: recordFields.studyDate || today(),
        sortOrder: 0,
      },
    });

    return { pending: updatedPending, record };
  }

  _normalizeText(value) {
    if (value === '' || value === undefined || value === null) return null;
    return value;
  }
}

export default new StudyPendingService();
