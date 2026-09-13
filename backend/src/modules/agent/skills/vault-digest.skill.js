/**
 * 技能：沉淀库概览（vault-digest）
 * 统计 Vault 沉淀条目数量与最近更新标题。纯本地只读。
 */
import { countTable, recentTitles } from './util.js';

export default {
  key: 'vault-digest',
  title: '沉淀库概览',
  description: '统计 Vault 沉淀条目数量与最近更新标题',
  keywords: ['vault', '沉淀', '笔记', '知识库', '总结', '概览'],
  async run({ prisma }) {
    const count = await countTable(prisma, 'vault_items');
    const recent = await recentTitles(prisma, 'vault_items', 'title', 5);
    return { count, recent, table: 'vault_items' };
  },
};
