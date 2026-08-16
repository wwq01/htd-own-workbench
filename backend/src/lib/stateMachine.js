/**
 * 通用状态机工厂（V1.3）
 * 统一的「合法迁移白名单 + 迁移钩子」抽象，供任务 / 项目 / 复盘等状态机复用。
 *
 *   createStateMachine({ name, initial, ALLOWED_TRANSITIONS, onTransition })
 *     - transition(from, to, payload) → { ok, from, to } 或抛 BusinessError（非法迁移）
 *     - isAllowed(from, to) → boolean
 *
 * 非法迁移统一抛 PARAM_ERROR，调用方无需各自写校验分支。
 */
import { BusinessError } from '../common/error.js';
import { ErrorCodes } from '../common/constants/index.js';

export function createStateMachine(cfg) {
  const { name, initial, ALLOWED_TRANSITIONS = {}, onTransition } = cfg || {};

  function isAllowed(from, to) {
    if (from === to) return true; // 自环允许
    const next = ALLOWED_TRANSITIONS[from];
    return Array.isArray(next) && next.includes(to);
  }

  async function transition(from, to, payload = {}) {
    if (!ALLOWED_TRANSITIONS.hasOwnProperty(from)) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, `${name}：未知状态「${from}」`);
    }
    if (!isAllowed(from, to)) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, `${name}：非法状态迁移「${from} → ${to}」`);
    }
    if (typeof onTransition === 'function') {
      await onTransition(from, to, payload);
    }
    return { ok: true, from, to };
  }

  return { name, initial, isAllowed, transition };
}

export default createStateMachine;
