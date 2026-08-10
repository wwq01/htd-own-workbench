/**
 * 部署记录模块 - Service 服务层
 */
import deploymentRepository from './deployment.repository.js';
import {
  createDeploymentSchema,
  updateDeploymentSchema,
  listDeploymentSchema,
  deploymentIdSchema,
} from './deployment.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';

class DeploymentService {
  async create(payload) {
    const data = createDeploymentSchema.parse(payload);
    return deploymentRepository.create({
      name: data.name,
      envType: data.envType,
      deviceType: this._normalizeText(data.deviceType),
      ipAddress: this._normalizeText(data.ipAddress),
      config: this._normalizeText(data.config),
      steps: this._normalizeText(data.steps),
      commands: this._normalizeText(data.commands),
      remark: this._normalizeText(data.remark),
      sortOrder: data.sortOrder ?? 0,
    });
  }

  async update(payload) {
    const parsed = updateDeploymentSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await deploymentRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '部署记录不存在');
    }

    const updateData = {};
    if ('name' in fields) updateData.name = fields.name;
    if ('envType' in fields) updateData.envType = fields.envType;
    if ('deviceType' in fields) updateData.deviceType = this._normalizeText(fields.deviceType);
    if ('ipAddress' in fields) updateData.ipAddress = this._normalizeText(fields.ipAddress);
    if ('config' in fields) updateData.config = this._normalizeText(fields.config);
    if ('steps' in fields) updateData.steps = this._normalizeText(fields.steps);
    if ('commands' in fields) updateData.commands = this._normalizeText(fields.commands);
    if ('remark' in fields) updateData.remark = this._normalizeText(fields.remark);
    if ('sortOrder' in fields) updateData.sortOrder = fields.sortOrder;

    return deploymentRepository.updateById(id, updateData);
  }

  async delete(id) {
    deploymentIdSchema.parse({ id });
    const exists = await deploymentRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '部署记录不存在');
    }
    return deploymentRepository.softDeleteById(id);
  }

  async getById(id) {
    deploymentIdSchema.parse({ id });
    const item = await deploymentRepository.findById(id);
    if (!item) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '部署记录不存在');
    }
    return item;
  }

  async list(query = {}) {
    const q = listDeploymentSchema.parse(query);
    return deploymentRepository.listWithFilters({
      envType: q.envType,
      keyword: q.keyword,
    });
  }

  /**
   * 各环境类型数量统计
   */
  async getEnvStats() {
    return deploymentRepository.countByEnvType();
  }

  _normalizeText(value) {
    if (value === '' || value === undefined || value === null) return null;
    return value;
  }
}

export default new DeploymentService();
