/**
 * 统一事件总线（Observable 模式）
 * Service 之间通过事件解耦：备份完成 emit('backup:completed')，其他服务监听即可。
 */
export class Observable {
  constructor() {
    this._listeners = new Map(); // event -> Set<fn>
  }
  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this.off(event, fn); // 返回取消订阅函数
  }
  off(event, fn) {
    const set = this._listeners.get(event);
    if (set) set.delete(fn);
  }
  emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(payload); } catch (err) { console.error(`[eventBus] listener error on "${event}":`, err); }
    }
  }
}
export const eventBus = new Observable();
export default eventBus;
