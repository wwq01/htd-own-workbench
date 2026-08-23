/**
 * 极简 Hash 路由
 * 基于 hashchange 事件，支持业务模块和系统设置路由
 */

// 路由配置：hash -> { title, component }
const routes = {};

// 当前路由状态
let currentRoute = null;
let currentComponent = null;

/**
 * 注册路由
 */
function registerRoute(path, config) {
  routes[path] = config;
}

/**
 * 解析当前 hash
 * @returns { path, params }
 */
function parseHash() {
  const hash = window.location.hash.slice(1) || '/'; // 去掉 #，默认 /
  const [path, queryString] = hash.split('?');
  const params = {};

  if (queryString) {
    const searchParams = new URLSearchParams(queryString);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  }

  return { path, params };
}

/**
 * 路由匹配
 * 支持动态路由参数，如 /project/:id
 */
function matchRoute(path) {
  // 精确匹配
  if (routes[path]) {
    return { route: routes[path], params: {} };
  }

  // 动态路由匹配
  for (const routePath of Object.keys(routes)) {
    if (routePath.includes(':')) {
      const routeParts = routePath.split('/');
      const pathParts = path.split('/');
      if (routeParts.length === pathParts.length) {
        const params = {};
        let matched = true;
        for (let i = 0; i < routeParts.length; i++) {
          if (routeParts[i].startsWith(':')) {
            params[routeParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
          } else if (routeParts[i] !== pathParts[i]) {
            matched = false;
            break;
          }
        }
        if (matched) {
          return { route: routes[routePath], params };
        }
      }
    }
  }

  return null;
}

/**
 * 导航到指定路径
 */
function navigate(path) {
  window.location.hash = path;
}

/**
 * 渲染当前路由对应的页面
 */
function renderRoute() {
  const { path, params } = parseHash();
  const matched = matchRoute(path);

  if (!matched) {
    // 默认跳转首页
    navigate('/');
    return;
  }

  const { route, params: routeParams } = matched;
  currentRoute = route;

  // 更新顶部标题
  const titleEl = document.querySelector('#page-title');
  if (titleEl) {
    titleEl.textContent = route.title || '';
  }

  // 更新导航激活态
  document.querySelectorAll('.app-sidebar__nav-item').forEach((item) => {
    item.classList.toggle('app-sidebar__nav-item--active', item.dataset.route === path);
  });

  // 渲染页面组件
  const app = window.__htdApp;
  if (app) {
    // 合并 hash query 参数和动态路由参数
    const allParams = { ...params, ...routeParams };
    app.currentRoute = route;
    app.currentParams = allParams;
    app.currentPath = path;
  }
}

/**
 * 初始化路由
 */
function initRouter() {
  // 注册所有路由
  registerRoute('/', { title: '首页总览', module: 'home' });
  registerRoute('/todo', { title: '今日工作 / 明日计划', module: 'todo' });
  registerRoute('/project', { title: '项目管理', module: 'project' });
  registerRoute('/develop', { title: '开发工作', module: 'develop' });
  registerRoute('/entertainment', { title: '游戏娱乐', module: 'entertainment' });
  registerRoute('/study', { title: '充电学习', module: 'study' });
  registerRoute('/review', { title: '复盘与沉淀', module: 'review' });
  registerRoute('/secret', { title: '轻量凭据保险箱', module: 'secret' });
  registerRoute('/data', { title: '数据与部署', module: 'data' });
  registerRoute('/settings', { title: '系统设置', module: 'settings' });
  registerRoute('/meeting', { title: '会议纪要', module: 'meeting' });
  registerRoute('/habit', { title: '习惯打卡', module: 'habit' });
  registerRoute('/time-block', { title: '时间块/番茄钟', module: 'time-block' });
  registerRoute('/finance', { title: '财务速记', module: 'finance' });
  registerRoute('/vault', { title: '沉淀 Vault', module: 'vault' });
  registerRoute('/system/recycle-bin', { title: '回收站', module: 'recycle-bin' });
  registerRoute('/poc', { title: 'POC 跟踪', module: 'poc' });
  registerRoute('/bid', { title: '投标档案', module: 'bid' });
  registerRoute('/vuln', { title: '漏洞跟踪库', module: 'vuln' });
  registerRoute('/incident', { title: '应急响应记录', module: 'incident' });

  // 监听 hash 变化
  window.addEventListener('hashchange', renderRoute);

  // 初始渲染
  if (!window.location.hash) {
    navigate('/');
  } else {
    renderRoute();
  }
}

// 暴露到全局
window.htdRouter = { navigate, initRouter, parseHash, registerRoute };
