/**
 * observable 事件总线纯逻辑测试（不依赖 fs / 网络）
 */
import { describe, it, expect } from 'vitest';
import { Observable, eventBus } from './observable.js';

describe('Observable 事件总线', () => {
  it('on 注册的监听器在 emit 时被触发并收到 payload', () => {
    const bus = new Observable();
    const received = [];
    bus.on('test:event', (payload) => received.push(payload));
    bus.emit('test:event', { id: 1 });
    expect(received).toEqual([{ id: 1 }]);
  });

  it('多个监听器都能收到同一事件', () => {
    const bus = new Observable();
    const a = [];
    const b = [];
    bus.on('multi', (p) => a.push(p));
    bus.on('multi', (p) => b.push(p));
    bus.emit('multi', 'hello');
    expect(a).toEqual(['hello']);
    expect(b).toEqual(['hello']);
  });

  it('off 之后该监听器不再被触发', () => {
    const bus = new Observable();
    const received = [];
    const off = bus.on('off:event', (p) => received.push(p));
    bus.emit('off:event', 1);
    off(); // 取消订阅
    bus.emit('off:event', 2);
    expect(received).toEqual([1]);
  });

  it('监听器抛错不影响其他监听器', () => {
    const bus = new Observable();
    const received = [];
    bus.on('err:event', () => { throw new Error('boom'); });
    bus.on('err:event', (p) => received.push(p));
    expect(() => bus.emit('err:event', 42)).not.toThrow();
    expect(received).toEqual([42]);
  });

  it('emit 未注册事件时安全无操作', () => {
    const bus = new Observable();
    expect(() => bus.emit('never:registered', 1)).not.toThrow();
  });

  it('on 返回的函数可重复调用移除同一监听器', () => {
    const bus = new Observable();
    const received = [];
    const off = bus.on('dup:off', (p) => received.push(p));
    off();
    off(); // 重复移除不应报错
    bus.emit('dup:off', 1);
    expect(received).toEqual([]);
  });
});

describe('eventBus 单例', () => {
  it('导出的 eventBus 是 Observable 实例且可正常收发', () => {
    expect(eventBus).toBeInstanceOf(Observable);
    let hit = false;
    const off = eventBus.on('singleton:ping', () => { hit = true; });
    eventBus.emit('singleton:ping');
    off();
    expect(hit).toBe(true);
  });
});
