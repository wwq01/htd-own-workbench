/**
 * 技能：指令转待办（todo-extract）
 * 从指令文本提取行动项。纯本地文本处理，不读库。
 */
const ACTION_PREFIX = /^(待办|做|完成|处理|跟进|准备|写|看|买|联系|开会|复盘|安排|整理|检查|确认|提交|回复|学习)/;

export default {
  key: 'todo-extract',
  title: '指令转待办',
  description: '从指令文本提取行动项（以 -、*、数字编号或动作动词开头的行）',
  keywords: ['todo', '待办', '任务', '提取', '行动项', '清单', '安排'],
  async run({ prompt }) {
    const lines = String(prompt || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const items = [];
    for (const line of lines) {
      // 去掉项目符号 / 编号前缀
      const cleaned = line
        .replace(/^[-*]\s*/, '')
        .replace(/^\d+[.、)]\s*/, '')
        .trim();
      if (!cleaned) continue;
      const isBullet = /^[-*]/.test(line) || /^\d+[.、)]/.test(line);
      if (isBullet || ACTION_PREFIX.test(cleaned)) {
        if (!items.includes(cleaned)) items.push(cleaned);
      }
    }
    return { extracted: items, count: items.length };
  },
};
