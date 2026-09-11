/**
 * 配置驱动的 Zod 校验片段（V1.5 §8.3）
 *
 * 下拉项 / 状态值不再硬编码为 z.enum，改为运行期从「字段 / 状态机配置平台」读取，
 * 用户在设置里增删下拉项、调整状态机后即时生效。
 *
 * 注意：zod 的 refine 为同步执行，无法在校验中 await 数据库，
 * 因此这里读取 FieldConfigService 的同步缓存；业务入口需先
 * `await ensureFieldConfigCache()` 装载缓存。缓存未装载时
 * getDropdownSync / getStateMachineSync 自动回落到默认枚举，
 * 保证既有「直接对 schema 调 safeParse」的用例行为不变。
 */
import { z } from 'zod';
import {
  getDropdownSync,
  getStateMachineSync,
} from '../modules/system/fieldConfig.service.js';

/**
 * 下拉项校验：取值必须落在配置平台的该 scope 下拉项集内
 * @param {string} scope 例如 'reading.type' / 'project.phase' / 'todo.category'
 * @param {string} msg 校验失败提示
 */
export function dropdownValue(scope, msg) {
  return z
    .string()
    .min(1)
    .max(50)
    .refine((v) => getDropdownSync(scope).includes(v), msg);
}

/**
 * 状态机状态值校验：取值必须落在配置平台该状态机的 states 内
 * 未纳管的状态机域（配置平台无此 scope）不做约束，避免出现全量拒绝的黑洞
 * @param {string} scope 例如 'reading.status' / 'project.phase'
 * @param {string} msg 校验失败提示
 */
export function stateValue(scope, msg) {
  return z
    .string()
    .min(1)
    .max(50)
    .refine((v) => {
      const sm = getStateMachineSync(scope);
      if (!sm || !Array.isArray(sm.states)) return true;
      return sm.states.includes(v);
    }, msg);
}
