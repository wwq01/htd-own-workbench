/**
 * 前端工具函数 - 通用方法
 */

/**
 * 生成唯一 ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * 防抖
 */
function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * 深拷贝
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 安全获取 JSON（解析失败返回默认值）
 */
function safeJsonParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

/**
 * 文本脱敏
 */
function maskText(text, visibleStart = 0, visibleEnd = 0) {
  if (!text) return '';
  if (text.length <= visibleStart + visibleEnd) {
    return '*'.repeat(text.length);
  }
  const start = text.slice(0, visibleStart);
  const end = text.slice(-visibleEnd);
  const middle = '*'.repeat(Math.min(text.length - visibleStart - visibleEnd, 8));
  return start + middle + end;
}

/**
 * 格式化数字（千分位）
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 空值检查
 */
function isEmpty(value) {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}

window.htdCommon = { generateId, debounce, deepClone, safeJsonParse, maskText, formatNumber, isEmpty };
