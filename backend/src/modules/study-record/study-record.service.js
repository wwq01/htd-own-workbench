/**
 * 学习记录模块 - Service 服务层
 */
import studyRecordRepository from './study-record.repository.js';
import {
  createStudyRecordSchema,
  updateStudyRecordSchema,
  listStudyRecordSchema,
  studyRecordIdSchema,
} from './study-record.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';

class StudyRecordService {
  async create(payload) {
    const data = createStudyRecordSchema.parse(payload);
    return studyRecordRepository.create({
      type: data.type,
      techDirection: this._normalizeText(data.techDirection),
      topic: data.topic,
      notes: this._normalizeText(data.notes),
      source: this._normalizeText(data.source),
      duration: data.duration,
      studyDate: data.studyDate,
      sortOrder: data.sortOrder ?? 0,
    });
  }

  async update(payload) {
    const parsed = updateStudyRecordSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await studyRecordRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '学习记录不存在');
    }

    const updateData = {};
    if ('type' in fields) updateData.type = fields.type;
    if ('techDirection' in fields) updateData.techDirection = this._normalizeText(fields.techDirection);
    if ('topic' in fields) updateData.topic = fields.topic;
    if ('notes' in fields) updateData.notes = this._normalizeText(fields.notes);
    if ('source' in fields) updateData.source = this._normalizeText(fields.source);
    if ('duration' in fields) updateData.duration = fields.duration;
    if ('studyDate' in fields) updateData.studyDate = fields.studyDate;
    if ('sortOrder' in fields) updateData.sortOrder = fields.sortOrder;

    return studyRecordRepository.updateById(id, updateData);
  }

  async delete(id) {
    studyRecordIdSchema.parse({ id });
    const exists = await studyRecordRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '学习记录不存在');
    }
    return studyRecordRepository.softDeleteById(id);
  }

  async getById(id) {
    studyRecordIdSchema.parse({ id });
    const record = await studyRecordRepository.findById(id);
    if (!record) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '学习记录不存在');
    }
    return record;
  }

  async list(query = {}) {
    const q = listStudyRecordSchema.parse(query);
    return studyRecordRepository.listWithFilters({
      type: q.type,
      techDirection: q.techDirection,
    });
  }

  /**
   * 获取周/月学习时长统计
   */
  async getDurationStats() {
    const [weekHours, monthHours] = await Promise.all([
      studyRecordRepository.sumWeekDuration(),
      studyRecordRepository.sumMonthDuration(),
    ]);
    return {
      weekHours: parseFloat(weekHours.toFixed(1)),
      monthHours: parseFloat(monthHours.toFixed(1)),
    };
  }

  _normalizeText(value) {
    if (value === '' || value === undefined || value === null) return null;
    return value;
  }
}

export default new StudyRecordService();
