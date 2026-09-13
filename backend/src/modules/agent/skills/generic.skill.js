/**
 * 技能：通用分析（generic，默认兜底）
 * 对指令做本地确定性分析：词数、字符数、建议标签。不联网、不调用外部大模型。
 */
const TAG_DICT = {
  总结: 'summary', 计划: 'plan', 漏洞: 'vuln', 投标: 'bid', 阅读: 'reading',
  会议: 'meeting', 财务: 'finance', 项目: 'project', 待办: 'todo', 备份: 'backup',
  加密: 'security', 复习: 'review', 知识: 'knowledge',
};

export default {
  key: 'generic',
  title: '通用分析（本地）',
  description: '对指令做本地确定性分析：词数、字符数、建议标签（无需联网）',
  keywords: [],
  async run({ prompt }) {
    const text = String(prompt || '');
    const words = (text.match(/[一-龥]|[A-Za-z0-9]+/g) || []).length;
    const chars = text.length;
    const suggestedTags = [];
    for (const [k, v] of Object.entries(TAG_DICT)) {
      if (text.includes(k) && !suggestedTags.includes(v)) suggestedTags.push(v);
    }
    return {
      note: '本地确定性 Agent：不调用外部大模型，基于规则分析你的指令与本地数据。',
      words,
      chars,
      suggestedTags,
    };
  },
};
