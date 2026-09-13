/**
 * 技能：数据库健康巡检（db-health）
 * 统计各模块数据量并确认本地数据库可读。纯本地只读。
 */
import { countTable } from './util.js';

const TABLES = [
  'memos', 'todos', 'projects', 'vault_items', 'reading_materials',
  'notes', 'poc_trackings', 'vuln_tracks', 'bid_archives', 'emergency_responses',
  'meetings', 'habits', 'finance_records', 'study_records',
];

export default {
  key: 'db-health',
  title: '数据库健康巡检',
  description: '统计各模块数据量并确认本地数据库可读',
  keywords: ['健康', 'health', '数据库', '状态', '巡检', '统计'],
  async run({ prisma }) {
    const tables = {};
    for (const t of TABLES) {
      tables[t] = await countTable(prisma, t);
    }
    const total = Object.values(tables).reduce((a, b) => a + b, 0);
    return { tables, total, engine: 'sqlite-local' };
  },
};
