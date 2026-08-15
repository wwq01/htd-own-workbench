// 前端同构事件总线（API 与后端一致，便于复用）：on/off/emit，单监听器抛错不中断其他

// 创建一个轻量可观察对象，维护 event -> Set<fn> 的监听器表
function createObservable() {
  const listeners = new Map();
  return {
    // 订阅某事件，返回取消订阅函数，便于解绑
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => off(event, fn);
    },
    // 取消某事件的某个监听器
    off(event, fn) {
      const set = listeners.get(event);
      if (set) {
        set.delete(fn);
        if (set.size === 0) listeners.delete(event);
      }
    },
    // 触发某事件，依次调用所有监听器；单个监听器抛错不中断其余
    emit(event, payload) {
      const set = listeners.get(event);
      if (!set) return;
      for (const fn of Array.from(set)) {
        try {
          fn(payload);
        } catch (e) {
          // 隔离单个监听器错误，避免一个坏监听拖垮整条事件
          console.error(`[eventBus] listener for "${event}" threw:`, e);
        }
      }
    },
  };
}

// 全局默认事件总线实例
const eventBus = createObservable();
