/**
 * 通用 CRUD 抽象基类
 * 所有业务 Repository 继承此类，获得标准增删改查能力
 */
import prisma from './prisma.js';
import { BusinessError } from '../common/error.js';
import { ErrorCodes } from '../common/constants/index.js';

export class BaseRepository {
  /**
   * @param {string} modelName - Prisma 模型名称（如 'todo', 'project'）
   */
  constructor(modelName) {
    this.model = prisma[modelName];
    this.modelName = modelName;
  }

  /**
   * 新增
   */
  async create(data) {
    try {
      return await this.model.create({ data });
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * 批量新增
   */
  async createMany(data) {
    try {
      return await this.model.createMany({ data });
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * 根据 ID 查询（默认排除软删除）
   */
  async findById(id, options = {}) {
    try {
      return await this.model.findFirst({
        where: { id, deletedAt: null, ...options.where },
        include: options.include,
        select: options.select,
      });
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * 查询单条
   */
  async findOne(where, options = {}) {
    try {
      return await this.model.findFirst({
        where: { deletedAt: null, ...where },
        include: options.include,
        select: options.select,
        orderBy: options.orderBy,
      });
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * 查询多条（带分页、筛选、排序）
   */
  async findMany(options = {}) {
    try {
      const {
        where = {},
        include,
        select,
        orderBy = { createdAt: 'desc' },
        page,
        pageSize,
      } = options;

      const queryWhere = { deletedAt: null, ...where };

      // 不分页：直接返回全部
      if (!page || !pageSize) {
        return await this.model.findMany({
          where: queryWhere,
          include,
          select,
          orderBy,
        });
      }

      // 分页查询
      const skip = (page - 1) * pageSize;
      const [list, total] = await Promise.all([
        this.model.findMany({
          where: queryWhere,
          include,
          select,
          orderBy,
          skip,
          take: pageSize,
        }),
        this.model.count({ where: queryWhere }),
      ]);

      return {
        list,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * 查询全部（不含分页）
   */
  async findAll(where = {}, options = {}) {
    try {
      return await this.model.findMany({
        where: { deletedAt: null, ...where },
        include: options.include,
        select: options.select,
        orderBy: options.orderBy || { createdAt: 'desc' },
      });
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * 统计数量
   */
  async count(where = {}) {
    try {
      return await this.model.count({
        where: { deletedAt: null, ...where },
      });
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * 根据 ID 更新
   */
  async updateById(id, data) {
    try {
      return await this.model.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * 条件更新
   */
  async update(where, data) {
    try {
      return await this.model.updateMany({
        where: { deletedAt: null, ...where },
        data,
      });
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * 软删除（根据 ID）
   */
  async softDeleteById(id) {
    try {
      return await this.model.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * 批量软删除
   */
  async softDelete(where) {
    try {
      return await this.model.updateMany({
        where: { deletedAt: null, ...where },
        data: { deletedAt: new Date() },
      });
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * 硬删除（根据 ID，谨慎使用）
   */
  async deleteById(id) {
    try {
      return await this.model.delete({
        where: { id },
      });
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * 错误处理
   */
  _handleError(error) {
    // Prisma 记录不存在错误
    if (error.code === 'P2025') {
      return new BusinessError(ErrorCodes.DB_NOT_FOUND, '数据不存在');
    }
    // Prisma 唯一约束冲突
    if (error.code === 'P2002') {
      return new BusinessError(ErrorCodes.DB_DUPLICATE, '数据已存在');
    }
    // 其他 Prisma 错误
    if (error.code?.startsWith('P')) {
      return new BusinessError(ErrorCodes.DB_ERROR, `数据库错误: ${error.message}`);
    }
    // 已是 BusinessError 则直接返回
    if (error instanceof BusinessError) {
      return error;
    }
    // 未知错误
    return new BusinessError(ErrorCodes.UNKNOWN_ERROR, error.message);
  }
}
