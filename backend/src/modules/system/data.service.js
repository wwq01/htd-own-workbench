/**
 * 数据导出、导入、清空服务。
 * 这里集中维护表顺序：删除时子表在前，恢复时主表在前。
 */
import prisma from '../../database/prisma.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { importDataSchema, destructiveActionSchema } from './data.schema.js';

const TABLES = [
  { name: 'memos', model: 'memo' },
  { name: 'todos', model: 'todo' },
  { name: 'projects', model: 'project' },
  { name: 'project_milestones', model: 'projectMilestone' },
  { name: 'project_tasks', model: 'projectTask' },
  { name: 'dev_projects', model: 'devProject' },
  { name: 'dev_snippets', model: 'devSnippet' },
  { name: 'dev_issues', model: 'devIssue' },
  { name: 'entertainments', model: 'entertainment' },
  { name: 'study_records', model: 'studyRecord' },
  { name: 'study_pendings', model: 'studyPending' },
  { name: 'reviews', model: 'review' },
  { name: 'secrets', model: 'secret' },
  { name: 'deployments', model: 'deployment' },
];

const DELETE_ORDER = [...TABLES].reverse();

export const CLEAR_SCOPES = {
  all: TABLES.map((table) => table.name),
  life: ['memos', 'todos'],
  business: ['projects', 'project_milestones', 'project_tasks'],
  development: ['dev_projects', 'dev_snippets', 'dev_issues'],
  study: ['study_records', 'study_pendings'],
  entertainment: ['entertainments'],
  review: ['reviews'],
  secret: ['secrets'],
  deployment: ['deployments'],
};

const DATE_FIELDS = new Set(['createdAt', 'updatedAt', 'deletedAt', 'completedAt']);

function normalizeRow(row) {
  const normalized = { ...row };
  for (const [key, value] of Object.entries(normalized)) {
    if (DATE_FIELDS.has(key) && value !== null && value !== undefined) {
      normalized[key] = new Date(value);
      if (Number.isNaN(normalized[key].getTime())) {
        throw new BusinessError(ErrorCodes.PARAM_ERROR, `数据字段 ${key} 的日期格式无效`);
      }
    }
  }
  return normalized;
}

class DataService {
  async exportAll() {
    const tables = {};
    for (const table of TABLES) {
      tables[table.name] = await prisma[table.model].findMany({
        orderBy: { createdAt: 'asc' },
      });
    }

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tables,
    };
  }

  async importAll(payload) {
    const data = importDataSchema.parse(payload);
    const knownTables = new Set(TABLES.map((table) => table.name));
    const unknownTables = Object.keys(data.tables).filter((name) => !knownTables.has(name));
    if (unknownTables.length > 0) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, `导入文件包含未知数据表：${unknownTables.join('、')}`);
    }
    if (data.mode === 'full') {
      const missingTables = TABLES.map((table) => table.name).filter((name) => !Object.hasOwn(data.tables, name));
      if (missingTables.length > 0) {
        throw new BusinessError(ErrorCodes.PARAM_ERROR, `全量导入文件缺少数据表：${missingTables.join('、')}`);
      }
    }

    const result = { added: 0, updated: 0, skipped: 0, importedCount: 0, conflicts: [] };
    await prisma.$transaction(async (tx) => {
      if (data.mode === 'full') {
        for (const table of DELETE_ORDER) {
          await tx[table.model].deleteMany();
        }
      }

      for (const table of TABLES) {
        const rows = (data.tables[table.name] || []).map(normalizeRow);
        for (const row of rows) {
          const existing = row.id ? await tx[table.model].findUnique({ where: { id: row.id } }) : null;
          if (existing && data.mode === 'skip') {
            result.skipped++;
            result.conflicts.push({ table: table.name, id: row.id, reason: '已存在，已跳过' });
            continue;
          }
          if (existing && data.mode === 'overwrite') {
            await tx[table.model].update({ where: { id: row.id }, data: row });
            result.updated++;
            result.conflicts.push({ table: table.name, id: row.id, reason: '已存在，已覆盖' });
            continue;
          }
          await tx[table.model].create({ data: row });
          result.added++;
        }
      }
    });

    result.importedCount = result.added + result.updated;
    return { ...result, tableCount: TABLES.length };
  }

  async clearAll(payload) {
    const data = destructiveActionSchema.parse(payload);
    const tableNames = CLEAR_SCOPES[data.scope];
    if (!tableNames) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, '清空范围无效');
    }
    const tablesToDelete = TABLES.filter((table) => tableNames.includes(table.name));
    const deleteOrder = [...tablesToDelete].sort((a, b) => DELETE_ORDER.indexOf(a) - DELETE_ORDER.indexOf(b));
    let deletedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const table of deleteOrder) {
        const result = await tx[table.model].deleteMany();
        deletedCount += result.count;
      }
    });

    return { deletedCount, scope: data.scope, tableCount: tablesToDelete.length };
  }
}

export { TABLES };
export default new DataService();
