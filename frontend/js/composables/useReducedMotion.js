// 组合式函数：读取并响应系统「减少动效」偏好（prefers-reduced-motion）

// 返回响应式 ref<boolean> isReduced，反映系统是否要求减少动效；并随系统设置实时更新
function useReducedMotion() {
  const isReduced = Vue.ref(false);
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  const apply = () => { isReduced.value = mql.matches; };
  apply(); // 初始化为当前系统设置
  // 监听系统偏好变化，实时同步
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', apply);
  } else if (typeof mql.addListener === 'function') {
    // 兼容旧版 Safari 的写法
    mql.addListener(apply);
  }
  return isReduced;
}
