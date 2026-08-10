/**
 * 项目任务模块 - Service 服务层
 */
import taskRepository from './task.repository.js';
import projectRepository from '../project/project.repository.js';
import {
  createTaskSchema,
  updateTaskSchema,
  listTaskSchema,
  taskIdSchema,
} from './task.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';

class TaskService {
  /**
   * 新增任务
   */
  async create(payload) {
    const data = createTaskSchema.parse(payload);
    const project = await projectRepository.findById(data.projectId);
    if (!project) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '关联项目不存在');
    }
    return taskRepository.create({
      projectId: data.projectId,
      name: data.name,
      completed: data.completed ?? false,
      sortOrder: data.sortOrder ?? 0,
    });
  }

  /**
   * 编辑任务
   */
  async update(payload) {
    const parsed = updateTaskSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await taskRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '任务不存在');
    }
    return taskRepository.updateById(id, fields);
  }

  /**
   * 切换完成状态
   */
  async toggleStatus(id) {
    taskIdSchema.parse({ id });
    const exists = await taskRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '任务不存在');
    }
    return taskRepository.updateById(id, { completed: !exists.completed });
  }

  /**
   * 软删除任务
   */
  async delete(id) {
    taskIdSchema.parse({ id });
    const exists = await taskRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '任务不存在');
    }
    return taskRepository.softDeleteById(id);
  }

  /**
   * 列表查询（按项目 ID）
   */
  async list(query = {}) {
    const q = listTaskSchema.parse(query);
    if (!q.projectId) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, 'projectId 不能为空');
    }
    return taskRepository.listByProject(q.projectId);
  }
}

export default new TaskService();
