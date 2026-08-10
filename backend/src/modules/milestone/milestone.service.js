/**
 * 项目里程碑模块 - Service 服务层
 */
import milestoneRepository from './milestone.repository.js';
import projectRepository from '../project/project.repository.js';
import {
  createMilestoneSchema,
  updateMilestoneSchema,
  listMilestoneSchema,
  milestoneIdSchema,
} from './milestone.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';

class MilestoneService {
  /**
   * 新增里程碑
   */
  async create(payload) {
    const data = createMilestoneSchema.parse(payload);
    // 校验项目存在
    const project = await projectRepository.findById(data.projectId);
    if (!project) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '关联项目不存在');
    }
    return milestoneRepository.create({
      projectId: data.projectId,
      name: data.name,
      dueDate: data.dueDate,
      completed: data.completed ?? false,
      sortOrder: data.sortOrder ?? 0,
    });
  }

  /**
   * 编辑里程碑
   */
  async update(payload) {
    const parsed = updateMilestoneSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await milestoneRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '里程碑不存在');
    }
    return milestoneRepository.updateById(id, fields);
  }

  /**
   * 切换完成状态
   */
  async toggleStatus(id) {
    milestoneIdSchema.parse({ id });
    const exists = await milestoneRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '里程碑不存在');
    }
    return milestoneRepository.updateById(id, { completed: !exists.completed });
  }

  /**
   * 软删除里程碑
   */
  async delete(id) {
    milestoneIdSchema.parse({ id });
    const exists = await milestoneRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '里程碑不存在');
    }
    return milestoneRepository.softDeleteById(id);
  }

  /**
   * 列表查询（按项目 ID）
   */
  async list(query = {}) {
    const q = listMilestoneSchema.parse(query);
    if (!q.projectId) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, 'projectId 不能为空');
    }
    return milestoneRepository.listByProject(q.projectId);
  }
}

export default new MilestoneService();
