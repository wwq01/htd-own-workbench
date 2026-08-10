/**
 * 备忘模块 - Service 服务层
 */
import memoRepository from './memo.repository.js';
import {
  createMemoSchema,
  updateMemoSchema,
  memoIdSchema,
  listMemoSchema,
} from './memo.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';

class MemoService {
  async create(payload) {
    const { content } = createMemoSchema.parse(payload);
    return memoRepository.create({ content });
  }

  async update(payload) {
    const { id, content } = updateMemoSchema.parse(payload);
    const exists = await memoRepository.findById(id);
    if (!exists) throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '备忘不存在');
    return memoRepository.updateById(id, { content });
  }

  async delete(id) {
    memoIdSchema.parse({ id });
    const exists = await memoRepository.findById(id);
    if (!exists) throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '备忘不存在');
    return memoRepository.softDeleteById(id);
  }

  async getById(id) {
    memoIdSchema.parse({ id });
    const memo = await memoRepository.findById(id);
    if (!memo) throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '备忘不存在');
    return memo;
  }

  async list(query = {}) {
    const q = listMemoSchema.parse(query);
    const options = {
      orderBy: { createdAt: 'desc' },
    };
    if (q.page && q.pageSize) {
      options.page = q.page;
      options.pageSize = q.pageSize;
    } else if (q.limit) {
      options.page = 1;
      options.pageSize = q.limit;
    }
    return memoRepository.findMany(options);
  }

  async listRecent(limit = 3) {
    const result = await memoRepository.listRecent(limit);
    // listRecent 使用分页；返回其 list 部分即可
    return result.list ?? result;
  }
}

export default new MemoService();
