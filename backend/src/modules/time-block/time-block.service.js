/**
 * 时间块模块 - Service 服务层
 */
import timeBlockRepository from './time-block.repository.js';
import {
  createTimeBlockSchema,
  updateTimeBlockSchema,
  listTimeBlockSchema,
  startTimeBlockSchema,
  stopTimeBlockSchema,
  timeBlockIdSchema,
} from './time-block.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { formatDate } from '../../common/utils/date.js';

// 构造列表查询 where 条件（type + startedAt 范围）
function buildWhere(query = {}) {
  const where = {};
  if (query.type) where.type = query.type;
  if (query.startedFrom || query.startedTo) {
    where.startedAt = {};
    if (query.startedFrom) where.startedAt.gte = new Date(query.startedFrom);
    if (query.startedTo) where.startedAt.lte = new Date(query.startedTo);
  }
  return where;
}

class TimeBlockService {
  /**
   * 列表查询（按 startedAt 倒序）
   * 支持筛选：type? / startedFrom? / startedTo?
   */
  async list(query = {}) {
    const q = listTimeBlockSchema.parse(query);
    return timeBlockRepository.findMany({
      where: buildWhere(q),
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * 根据 ID 获取详情
   */
  async getById(id) {
    timeBlockIdSchema.parse({ id });
    const block = await timeBlockRepository.findById(id);
    if (!block) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '时间块不存在');
    }
    return block;
  }

  /**
   * 新增时间块（自定义 startedAt / endedAt，用于补录）
   */
  async create(payload) {
    const data = createTimeBlockSchema.parse(payload);
    return timeBlockRepository.create({
      startedAt: new Date(data.startedAt),
      endedAt: data.endedAt ? new Date(data.endedAt) : null,
      plannedMinutes: data.plannedMinutes,
      actualMinutes: data.actualMinutes,
      type: data.type,
      relatedProjectId: data.relatedProjectId ?? null,
      relatedStudyId: data.relatedStudyId ?? null,
      note: data.note ?? null,
      interrupted: data.interrupted,
    });
  }

  /**
   * 开始一个时间块（番茄钟启动）
   * startedAt = now，实际时长 0，结束时再回填
   */
  async start(payload) {
    const data = startTimeBlockSchema.parse(payload);
    return timeBlockRepository.create({
      startedAt: new Date(),
      endedAt: null,
      plannedMinutes: data.plannedMinutes,
      actualMinutes: 0,
      type: data.type,
      relatedProjectId: data.relatedProjectId ?? null,
      relatedStudyId: data.relatedStudyId ?? null,
      note: data.note ?? null,
      interrupted: false,
    });
  }

  /**
   * 结束时间块（番茄钟停止）
   * 实际时长按 startedAt → endedAt 计算（分钟，四舍五入，最小 0）
   */
  async stop(id, body = {}) {
    timeBlockIdSchema.parse({ id });
    const { interrupted } = stopTimeBlockSchema.parse(body);
    const exists = await timeBlockRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '时间块不存在');
    }
    const endedAt = new Date();
    const actualMinutes = Math.max(
      0,
      Math.round((endedAt - new Date(exists.startedAt)) / 60000)
    );
    return timeBlockRepository.updateById(id, {
      endedAt,
      actualMinutes,
      interrupted,
    });
  }

  /**
   * 编辑时间块（部分字段更新）
   */
  async update(id, payload) {
    const parsed = updateTimeBlockSchema.parse({ id, ...payload });
    const { id: _id, ...fields } = parsed;
    const exists = await timeBlockRepository.findById(_id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '时间块不存在');
    }
    const updateData = {};
    if (fields.startedAt !== undefined) updateData.startedAt = new Date(fields.startedAt);
    if (fields.endedAt !== undefined) updateData.endedAt = fields.endedAt ? new Date(fields.endedAt) : null;
    if (fields.plannedMinutes !== undefined) updateData.plannedMinutes = fields.plannedMinutes;
    if (fields.actualMinutes !== undefined) updateData.actualMinutes = fields.actualMinutes;
    if (fields.type !== undefined) updateData.type = fields.type;
    if (fields.relatedProjectId !== undefined) updateData.relatedProjectId = fields.relatedProjectId ?? null;
    if (fields.relatedStudyId !== undefined) updateData.relatedStudyId = fields.relatedStudyId ?? null;
    if (fields.note !== undefined) updateData.note = fields.note ?? null;
    if (fields.interrupted !== undefined) updateData.interrupted = fields.interrupted;
    return timeBlockRepository.updateById(_id, updateData);
  }

  /**
   * 软删除时间块
   */
  async delete(id) {
    timeBlockIdSchema.parse({ id });
    const exists = await timeBlockRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '时间块不存在');
    }
    return timeBlockRepository.softDeleteById(id);
  }

  /**
   * 简单聚合统计
   * - byDay: 按 startedAt 的日期分组，汇总实际分钟数
   * - byType: 按类型分组，汇总实际分钟数
   * - totalToday: 今日实际分钟数合计
   */
  async getStats(query = {}) {
    const q = listTimeBlockSchema.parse(query);
    const blocks = await timeBlockRepository.findAll(buildWhere(q));

    // 按类型聚合
    const typeMap = {};
    for (const b of blocks) {
      typeMap[b.type] = (typeMap[b.type] || 0) + (b.actualMinutes || 0);
    }
    const byType = Object.keys(typeMap).map((type) => ({
      type,
      minutes: typeMap[type],
    }));

    // 按日期聚合
    const dayMap = {};
    for (const b of blocks) {
      if (!b.startedAt) continue;
      const ds = formatDate(b.startedAt);
      dayMap[ds] = (dayMap[ds] || 0) + (b.actualMinutes || 0);
    }
    const byDay = Object.keys(dayMap)
      .map((date) => ({ date, minutes: dayMap[date] }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 今日合计
    const todayStr = formatDate(new Date());
    const totalToday = blocks
      .filter((b) => formatDate(b.startedAt) === todayStr)
      .reduce((sum, b) => sum + (b.actualMinutes || 0), 0);

    return { byDay, byType, totalToday };
  }
}

export default new TimeBlockService();
