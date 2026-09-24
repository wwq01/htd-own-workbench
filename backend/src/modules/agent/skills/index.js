/**
 * 技能聚合入口：导入并注册全部技能，统一对外暴露注册表 API。
 * 新增技能只需在此数组追加一行（并在对应 *.skill.js 实现）。
 */
import { registerSkill, getSkill, listSkills, matchSkill, resolveSkill } from './registry.js';
import vaultDigest from './vault-digest.skill.js';
import todoExtract from './todo-extract.skill.js';
import dbHealth from './db-health.skill.js';
import generic from './generic.skill.js';
import weeklyReport from './weekly-report.skill.js';
import habitStats from './habit-stats.skill.js';
import financeSummary from './finance-summary.skill.js';
import projectBurndown from './project-burndown.skill.js';

[vaultDigest, todoExtract, dbHealth, generic, weeklyReport, habitStats, financeSummary, projectBurndown].forEach(
  registerSkill,
);

export { registerSkill, getSkill, listSkills, matchSkill, resolveSkill };
