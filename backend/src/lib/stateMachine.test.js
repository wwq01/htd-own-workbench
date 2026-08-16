/**
 * 通用状态机工厂单元测试（V1.3）
 * 验证 createStateMachine 的合法迁移白名单、自环、非法迁移抛错与钩子调用。
 */
import { describe, it, expect } from 'vitest';
import { createStateMachine } from './stateMachine.js';
import { BusinessError } from '../common/error.js';

// 通用示例迁移表（与真实状态机的结构一致）
const TM = {
  A: ['B', 'C'],
  B: ['C', 'A'],
  C: ['A'],
};

describe('createStateMachine 工厂', () => {
  const sm = createStateMachine({ name: 'Test', ALLOWED_TRANSITIONS: TM });

  it('isAllowed：合法迁移返回 true', () => {
    expect(sm.isAllowed('A', 'B')).toBe(true);
    expect(sm.isAllowed('A', 'C')).toBe(true);
    expect(sm.isAllowed('B', 'C')).toBe(true);
    expect(sm.isAllowed('B', 'A')).toBe(true);
    expect(sm.isAllowed('C', 'A')).toBe(true);
  });

  it('isAllowed：自环（from===to）始终返回 true', () => {
    expect(sm.isAllowed('A', 'A')).toBe(true);
    expect(sm.isAllowed('C', 'C')).toBe(true);
  });

  it('isAllowed：非法迁移返回 false', () => {
    expect(sm.isAllowed('A', 'D')).toBe(false);
    expect(sm.isAllowed('C', 'B')).toBe(false);
    expect(sm.isAllowed('C', 'C')).toBe(true); // 自环虽不在白名单也合法
  });

  it('transition：合法迁移返回 { ok:true, from, to }', async () => {
    const r = await sm.transition('A', 'B');
    expect(r).toEqual({ ok: true, from: 'A', to: 'B' });
  });

  it('transition：自环合法', async () => {
    const r = await sm.transition('B', 'B');
    expect(r.ok).toBe(true);
  });

  it('transition：非法迁移抛 BusinessError(PARAM_ERROR)', async () => {
    await expect(sm.transition('C', 'B')).rejects.toThrow(BusinessError);
  });

  it('transition：未知 from 状态抛错', async () => {
    await expect(sm.transition('Z', 'A')).rejects.toThrow();
  });

  it('transition：onTransition 钩子在迁移后调用', async () => {
    let called = false;
    const sm2 = createStateMachine({
      name: 'Hook',
      ALLOWED_TRANSITIONS: TM,
      onTransition: (from, to) => {
        called = true;
        expect(from).toBe('A');
        expect(to).toBe('B');
      },
    });
    await sm2.transition('A', 'B');
    expect(called).toBe(true);
  });
});
