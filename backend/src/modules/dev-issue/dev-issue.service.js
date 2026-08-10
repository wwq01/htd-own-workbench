/**
 * 开发问题模块 - Service 服务层
 */
import devIssueRepository from './dev-issue.repository.js';
import {
  createDevIssueSchema,
  updateDevIssueSchema,
  listDevIssueSchema,
  devIssueIdSchema,
} from './dev-issue.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';

class DevIssueService {
  async create(payload) {
    const data = createDevIssueSchema.parse(payload);
    return devIssueRepository.create({
      title: data.title,
      status: data.status,
      symptom: this._normalizeText(data.symptom),
      investigation: this._normalizeText(data.investigation),
      solution: this._normalizeText(data.solution),
      sortOrder: data.sortOrder ?? 0,
    });
  }

  async update(payload) {
    const parsed = updateDevIssueSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await devIssueRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '开发问题不存在');
    }

    const updateData = {};
    if ('title' in fields) updateData.title = fields.title;
    if ('status' in fields) updateData.status = fields.status;
    if ('symptom' in fields) updateData.symptom = this._normalizeText(fields.symptom);
    if ('investigation' in fields) updateData.investigation = this._normalizeText(fields.investigation);
    if ('solution' in fields) updateData.solution = this._normalizeText(fields.solution);
    if ('sortOrder' in fields) updateData.sortOrder = fields.sortOrder;

    return devIssueRepository.updateById(id, updateData);
  }

  async delete(id) {
    devIssueIdSchema.parse({ id });
    const exists = await devIssueRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '开发问题不存在');
    }
    return devIssueRepository.softDeleteById(id);
  }

  async getById(id) {
    devIssueIdSchema.parse({ id });
    const issue = await devIssueRepository.findById(id);
    if (!issue) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '开发问题不存在');
    }
    return issue;
  }

  async list(query = {}) {
    const q = listDevIssueSchema.parse(query);
    return devIssueRepository.listWithFilters({
      status: q.status,
      keyword: q.keyword,
    });
  }

  /**
   * 统计待解决问题数（首页统计用）
   */
  async countPending() {
    return devIssueRepository.countPending();
  }

  _normalizeText(value) {
    if (value === '' || value === undefined || value === null) return null;
    return value;
  }
}

export default new DevIssueService();
