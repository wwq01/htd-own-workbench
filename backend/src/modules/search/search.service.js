/**
 * 全文搜索模块 - Service 服务层（V1.5）
 * 跨模块模糊搜索：遍历已注册模块的文本字段，按模块分组返回结果。
 * 索引策略：SQLite 本地查询（contains），离线可用、零外部依赖；
 * 大数据量（>1w）场景可后续替换为 FTS5 虚表（见 docs/搜索与索引规范.md）。
 */
import prisma from '../../database/prisma.js';

// 模块注册表：每个模块的可搜索文本字段 + 标题/摘要字段 + 前端路由
// 新增可搜索模块时在此追加一条即可（frontend 命令面板分支自动消费 /search 结果）。
const MODULE_CONFIGS = [
  { module: 'todo', label: '待办', model: 'todo', fields: ['title', 'remark'], titleField: 'title', snippetField: 'remark', route: '/todo' },
  { module: 'project', label: '项目', model: 'project', fields: ['customerName', 'background', 'coreRequirements', 'projectMemo'], titleField: 'customerName', snippetField: 'coreRequirements', route: '/project' },
  { module: 'review', label: '复盘', model: 'review', fields: ['highlights', 'pitfalls', 'reusableExperience', 'improvements'], titleField: 'type', titlePrefix: '复盘', snippetField: 'highlights', route: '/review' },
  { module: 'vault', label: '沉淀', model: 'vaultItem', fields: ['topic', 'content'], titleField: 'topic', snippetField: 'content', route: '/vault' },
  { module: 'habit', label: '习惯', model: 'habit', fields: ['name'], titleField: 'name', snippetField: 'name', route: '/habit' },
  { module: 'time-block', label: '时间块', model: 'timeBlock', fields: ['note'], titleField: 'note', snippetField: 'note', route: '/time-block' },
  { module: 'finance', label: '财务', model: 'financeRecord', fields: ['remark', 'subCategory'], titleField: 'remark', snippetField: 'remark', route: '/finance' },
  { module: 'secret', label: '凭据', model: 'secret', fields: ['name', 'usageScenario', 'remark'], titleField: 'name', snippetField: 'usageScenario', route: '/secret' },
  { module: 'deployment', label: '部署', model: 'deployment', fields: ['name', 'config', 'steps', 'commands'], titleField: 'name', snippetField: 'name', route: '/data' },
  { module: 'meeting', label: '会议纪要', model: 'meeting', fields: ['title', 'agenda', 'decisions'], titleField: 'title', snippetField: 'title', route: '/meeting' },
  { module: 'poc', label: 'POC', model: 'pocTracking', fields: ['goal', 'result'], titleField: 'goal', snippetField: 'result', route: '/poc' },
  { module: 'bid', label: '投标', model: 'bidArchive', fields: ['bidNo'], titleField: 'bidNo', snippetField: 'bidNo', route: '/bid' },
  { module: 'vuln', label: '漏洞', model: 'vulnTrack', fields: ['vulnId', 'affectedProduct', 'reproduction'], titleField: 'vulnId', snippetField: 'affectedProduct', route: '/vuln' },
  { module: 'incident', label: '应急', model: 'emergencyResponse', fields: ['title', 'review'], titleField: 'title', snippetField: 'review', route: '/incident' },
  { module: 'reading', label: '阅读', model: 'readingMaterial', fields: ['title', 'notes', 'sourceUrl'], titleField: 'title', snippetField: 'notes', route: '/reading' },
];

function buildTitle(cfg, record) {
  const base = record[cfg.titleField];
  if (cfg.titlePrefix) return `${cfg.titlePrefix} · ${base || ''}`.trim();
  return base || '未命名';
}

function buildSnippet(cfg, record, max = 80) {
  const raw = record[cfg.snippetField];
  if (!raw) return '';
  return String(raw).length > max ? String(raw).slice(0, max) + '…' : String(raw);
}

class SearchService {
  /**
   * 跨模块搜索
   * @param {object} param0 { q, modules?, limit? }
   * @returns {Promise<{groups: Array, total: number}>}
   */
  async search({ q, modules, limit = 5 } = {}) {
    if (!q || !q.trim()) {
      return { groups: [], total: 0 };
    }
    const keyword = q.trim();
    const moduleFilter = modules
      ? modules.split(',').map((s) => s.trim()).filter(Boolean)
      : null;

    const groups = [];
    let total = 0;

    for (const cfg of MODULE_CONFIGS) {
      if (moduleFilter && !moduleFilter.includes(cfg.module)) continue;
      const model = prisma[cfg.model];
      if (!model) continue;

      const where = {
        deletedAt: null,
        OR: cfg.fields.map((f) => ({ [f]: { contains: keyword } })),
      };
      const rows = await model.findMany({
        where,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, [cfg.titleField]: true, [cfg.snippetField]: true },
      });

      if (rows.length) {
        const items = rows.map((r) => ({
          id: r.id,
          title: buildTitle(cfg, r),
          snippet: buildSnippet(cfg, r),
          route: cfg.route,
        }));
        groups.push({ module: cfg.module, label: cfg.label, items });
        total += items.length;
      }
    }

    return { groups, total };
  }
}

export default new SearchService();
export { MODULE_CONFIGS };
