/**
 * 开发项目模块 - Service 服务层
 */
import devProjectRepository from './dev-project.repository.js';
import {
  createDevProjectSchema,
  updateDevProjectSchema,
  listDevProjectSchema,
  devProjectIdSchema,
} from './dev-project.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { DEV_PROJECT_STATUS } from '../../common/constants/enums.js';

class DevProjectService {
  /**
   * 新增开发项目
   */
  async create(payload) {
    const data = createDevProjectSchema.parse(payload);
    const created = await devProjectRepository.create({
      name: data.name,
      description: this._normalizeText(data.description),
      status: data.status,
      techStack: JSON.stringify(data.techStack || []),
      todoItems: JSON.stringify(data.todoItems || []),
      sortOrder: data.sortOrder ?? 0,
    });
    return this._normalize(created);
  }

  /**
   * 编辑开发项目
   */
  async update(payload) {
    const parsed = updateDevProjectSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await devProjectRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '开发项目不存在');
    }

    const updateData = {};
    if ('name' in fields) updateData.name = fields.name;
    if ('status' in fields) updateData.status = fields.status;
    if ('description' in fields) updateData.description = this._normalizeText(fields.description);
    if ('techStack' in fields) updateData.techStack = JSON.stringify(fields.techStack || []);
    if ('todoItems' in fields) updateData.todoItems = JSON.stringify(fields.todoItems || []);
    if ('sortOrder' in fields) updateData.sortOrder = fields.sortOrder;

    return devProjectRepository.updateById(id, updateData);
  }

  /**
   * 软删除
   */
  async delete(id) {
    devProjectIdSchema.parse({ id });
    const exists = await devProjectRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '开发项目不存在');
    }
    return devProjectRepository.softDeleteById(id);
  }

  /**
   * 详情
   */
  async getById(id) {
    devProjectIdSchema.parse({ id });
    const project = await devProjectRepository.findById(id);
    if (!project) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '开发项目不存在');
    }
    return this._normalize(project);
  }

  /**
   * 列表
   */
  async list(query = {}) {
    const q = listDevProjectSchema.parse(query);
    const list = await devProjectRepository.listWithFilters({
      status: q.status,
      keyword: q.keyword,
    });
    return list.map(p => this._normalize(p));
  }

  /**
   * 对象规范化：techStack / todoItems 字符串 → 数组
   */
  _normalize(project) {
    if (!project) return project;
    let techStack = [];
    let todoItems = [];
    try {
      techStack = JSON.parse(project.techStack || '[]');
      if (!Array.isArray(techStack)) techStack = [];
    } catch (e) { techStack = []; }
    try {
      todoItems = JSON.parse(project.todoItems || '[]');
      if (!Array.isArray(todoItems)) todoItems = [];
    } catch (e) { todoItems = []; }
    return { ...project, techStack, todoItems };
  }

  _normalizeText(value) {
    if (value === '' || value === undefined || value === null) return null;
    return value;
  }
}

export default new DevProjectService();
