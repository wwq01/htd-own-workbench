// 组合式函数：URL 即状态（无 Vue Router，手写 query 读写 + 监听）

// 把 window.location.search 当作单一状态源：读取、写入、监听 URL 变化
function useSearchParams() {
  const listeners = new Set();

  // 解析当前 URL query 为普通对象
  function parse() {
    const params = {};
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of sp.entries()) params[k] = v;
    return params;
  }

  // 读取某 key 的值（无则 undefined）
  function get(key) {
    return new URLSearchParams(window.location.search).get(key);
  }

  // 写入某 key：更新 URL（replaceState 避免历史堆积），并通知本地监听
  function set(key, value) {
    const sp = new URLSearchParams(window.location.search);
    if (value === undefined || value === null || value === '') {
      sp.delete(key);
    } else {
      sp.set(key, value);
    }
    const qs = sp.toString();
    const newUrl = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
    window.history.replaceState(null, '', newUrl);
    notify();
  }

  // 内部：把最新 params 广播给所有监听器
  function notify() {
    const params = parse();
    for (const cb of Array.from(listeners)) {
      try { cb(params); } catch (e) { console.error('[useSearchParams] listener error:', e); }
    }
  }

  // 监听 URL 变化：popstate（前进/后退） + 自定义 set 通知；返回取消监听函数
  function watch(callback) {
    listeners.add(callback);
    const onPop = () => notify();
    window.addEventListener('popstate', onPop);
    return () => {
      listeners.delete(callback);
      window.removeEventListener('popstate', onPop);
    };
  }

  return { get, set, watch, parse };
}
