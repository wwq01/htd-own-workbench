/**
 * 技能注册表（单一数据源）
 * 新增能力 = 新建一个 *.skill.js 并在 skills/index.js 注册，零侵入现有代码。
 */
import { BusinessError } from '../../../common/error.js';
import { ErrorCodes } from '../../../common/constants/index.js';

const skills = new Map();

export function registerSkill(skill) {
  if (!skill || !skill.key || typeof skill.run !== 'function') {
    throw new Error('非法技能定义：必须包含 key 与 async run()');
  }
  skills.set(skill.key, skill);
}

export function getSkill(key) {
  return skills.get(key) || null;
}

export function listSkills() {
  return [...skills.values()].map((s) => ({
    key: s.key,
    title: s.title,
    description: s.description,
    keywords: s.keywords || [],
  }));
}

/**
 * 按指令关键字匹配技能（generic 作为兜底，永不命中关键字）
 */
export function matchSkill(prompt = '') {
  const p = String(prompt).toLowerCase();
  for (const s of skills.values()) {
    if (s.key === 'generic') continue;
    if ((s.keywords || []).some((k) => p.includes(String(k).toLowerCase()))) return s;
  }
  return getSkill('generic');
}

/**
 * 解析技能：显式指定且不存在 → 报错；auto → 关键字匹配；均未命中 → generic
 */
export function resolveSkill(skillKey, prompt) {
  if (skillKey && skillKey !== 'auto') {
    const s = getSkill(skillKey);
    if (!s) {
      throw new BusinessError(ErrorCodes.AGENT_SKILL_NOT_FOUND, `技能不存在：${skillKey}`);
    }
    return s;
  }
  return matchSkill(prompt);
}
