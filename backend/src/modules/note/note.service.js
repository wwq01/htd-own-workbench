/**
 * S2-4 双轨笔记模块 - Service 服务层
 *
 * 设计要点：
 * - 软关联：sourceType + sourceId，无外键，来源记录软删后笔记仍可追溯；
 * - 锚点：anchor 存 JSON 串 { start, end }，由 note.schema.js 统一校验；
 * - quote：原文片段快照，原文后续被修改时笔记仍可展示当时的引用内容。
 */
import noteRepository from './note.repository.js';
import {
  createNoteSchema,
  updateNoteSchema,
  listNoteSchema,
  noteIdSchema,
} from './note.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { NOTE_SOURCE_TYPE } from '../../common/constants/enums.js';

class NoteService {
  /**
   * 列表查询（支持 sourceType / sourceId / tag 筛选）
   * orderBy createdAt asc：双轨场景下笔记按原文出现顺序展示更符合直觉
   */
  async list(query = {}) {
    const q = listNoteSchema.parse(query);
    const where = {};
    if (q.sourceType) where.sourceType = q.sourceType;
    if (q.sourceId) where.sourceId = q.sourceId;
    // tags 以 JSON 字符串存储，使用 contains 做子串匹配
    if (q.tag) where.tags = { contains: q.tag };

    return noteRepository.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 按来源查询笔记（双轨主入口）
   */
  async listBySource(sourceType, sourceId) {
    return this.list({ sourceType, sourceId });
  }

  /**
   * 根据 ID 获取详情
   */
  async getById(id) {
    noteIdSchema.parse({ id });
    const item = await noteRepository.findById(id);
    if (!item) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '笔记不存在');
    }
    return item;
  }

  /**
   * 新增笔记
   */
  async create(payload) {
    const data = createNoteSchema.parse(payload);
    return noteRepository.create({
      sourceType: data.sourceType || NOTE_SOURCE_TYPE.READING,
      sourceId: data.sourceId || null,
      content: data.content,
      quote: data.quote || null,
      anchor: data.anchor || null,
      tags: data.tags && data.tags.length ? JSON.stringify(data.tags) : '[]',
    });
  }

  /**
   * 编辑笔记（部分字段更新）
   */
  async update(id, payload) {
    const parsed = updateNoteSchema.parse({ id, ...payload });
    const { id: _id, ...fields } = parsed;
    const exists = await noteRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '笔记不存在');
    }

    const updateData = { ...fields };
    // tags 以 JSON 字符串存储，存在时重新序列化
    if ('tags' in updateData) {
      updateData.tags = Array.isArray(updateData.tags) && updateData.tags.length
        ? JSON.stringify(updateData.tags)
        : '[]';
    }
    // 空字符串处理为 null，避免留下空值噪声
    ['sourceId', 'quote', 'anchor'].forEach((key) => {
      if (key in updateData && updateData[key] === '') updateData[key] = null;
    });

    return noteRepository.updateById(id, updateData);
  }

  /**
   * 软删除笔记
   */
  async delete(id) {
    noteIdSchema.parse({ id });
    const exists = await noteRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '笔记不存在');
    }
    return noteRepository.softDeleteById(id);
  }
}

export default new NoteService();
