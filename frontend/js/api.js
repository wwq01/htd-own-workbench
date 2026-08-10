/**
 * 统一接口请求封装
 * 基于原生 Fetch API，统一处理响应、错误提示
 */

// API 基础路径
const API_BASE = '/api/v1';

/**
 * 显示 Toast 提示
 */
function showToast(msg, type = 'info') {
  let container = document.querySelector('.htd-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'htd-toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `htp-toast htd-toast--${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 200ms';
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

// 暴露到全局
window.showToast = showToast;

/**
 * 统一请求方法
 */
async function request(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;

  const defaultHeaders = {};
  // 如果是 FormData，不设置 Content-Type（浏览器自动设置 boundary）
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    cache: 'no-store', // 禁用浏览器缓存，确保每次获取最新数据
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  // 序列化 body
  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(fullUrl, config);
    const data = await response.json();

    // 统一处理响应
    if (data.code === 0) {
      return data.data;
    } else {
      // 业务错误
      showToast(data.msg || '操作失败', 'error');
      throw new Error(data.msg || '操作失败');
    }
  } catch (error) {
    // 网络错误或 JSON 解析失败
    if (error.message === 'Failed to fetch') {
      showToast('网络请求失败，请检查服务是否启动', 'error');
    } else if (!error.msg) {
      // 非业务错误且非网络错误
      console.error('请求异常:', error);
    }
    throw error;
  }
}

/**
 * GET 请求
 */
async function get(url, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, value);
    }
  });
  const queryString = query.toString();
  return request(queryString ? `${url}?${queryString}` : url, { method: 'GET' });
}

/**
 * POST 请求
 */
async function post(url, data = {}) {
  return request(url, { method: 'POST', body: data });
}

/**
 * PUT 请求
 */
async function put(url, data = {}) {
  return request(url, { method: 'PUT', body: data });
}

/**
 * PATCH 请求
 */
async function patch(url, data = {}) {
  return request(url, { method: 'PATCH', body: data });
}

/**
 * DELETE 请求
 */
async function del(url, data = {}) {
  return request(url, { method: 'DELETE', body: data });
}

// 暴露到全局
window.htdApi = { request, get, post, put, patch, del, showToast };
