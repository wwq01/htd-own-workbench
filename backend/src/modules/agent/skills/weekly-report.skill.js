/**
 * 技能：本周工作周报（weekly-report）
 * 聚合本周各模块新增与全量数据，生成本地确定性周报。纯本地只读、不联网。
 */
import { countTable, recentTitles, countSince, weekStartTs } from './util.js';
import { formatDate, startOfWeek } from '../../../common/utils/date.js';

// 监控模块：物理表名 + 中文标签 + 可选时间列（默认 createdAt）
const MODULES = [
  { table: 'todos', label: '待办' },
  { table: 'projects', label: '项目' },
  { table: 'meetings', label: '会议', timeCol: 'heldAt' },
  { table: 'vault_items', label: '沉淀' },
  { table: 'reading_materials', label: '阅读' },
  { table: 'poc_trackings', label: 'POC' },
  { table: 'bid_archives', label: '投标' },
  { table: 'vuln_tracks', label: '漏洞' },
  { table: 'emergency_responses', label: '应急' },
  { table: 'study_records', label: '学习' },
  { table: 'finance_records', label: '财务' },
  { table: 'notes', label: '笔记' },
];

export default {
  key: 'weekly-report',
  title: '本周工作周报',
  description: '聚合本周各模块新增与全量数据，生成本地确定性周报（不联网）',
  keywords: ['周报', 'weekly', 'week', '本周', '复盘', '汇总', '汇报'],
  async run({ prisma }) {
    const since = weekStartTs();
    const total = {};
    const thisWeek = {};
    for (const { table, label, timeCol } of MODULES) {
      total[label] = await countTable(prisma, table);
      thisWeek[label] = await countSince(prisma, table, since, timeCol || 'createdAt');
    }
    const recentVault = await recentTitles(prisma, 'vault_items', 'topic', 5);
    return {
      weekStart: formatDate(startOfWeek(new Date())),
      today: formatDate(new Date()),
      total,
      thisWeek,
      recentVault,
      note: '本地确定性周报：基于本机 SQLite 各模块 createdAt/heldAt 统计，未联网。',
    };
  },
};
