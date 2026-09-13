/**
 * 访问令牌门禁（S4 服务端部署）
 *
 * 设计要点：
 * 1. **零回归**：未设置 HTD_ACCESS_TOKEN 时中间件完全放行，本机模式行为与之前一致。
 * 2. **令牌不落前端明文**：Cookie 中存的是令牌的 SHA-256，且 HttpOnly + SameSite=Lax，
 *    页面 JS 读不到，也顺带防住基础的 CSRF（跨站表单带不上本站 Cookie）。
 * 3. **timing-safe 比较**：避免通过响应耗时侧信道逐字节爆破令牌。
 * 4. **同时支持 Bearer**：便于 curl / 脚本 / 健康检查直接调用 API，不必先取 Cookie。
 * 5. **未授权分流**：API 返回 401 JSON（前端能识别并提示），页面请求返回内置登录页
 *    （自包含，不依赖任何静态资源——否则会被本中间件自己拦掉，形成死循环）。
 *
 * 已知边界：这是单令牌的单用户门禁，没有多账号与权限分级——本工作台定位就是个人自用。
 * 若要放到公网，仍应叠加反向代理的 HTTPS 与限流（见 docs/产品迭代/S4-服务端部署方案.md）。
 */
import crypto from 'crypto';
import path from 'path';
import appConfig from '../config/app.config.js';

const COOKIE_NAME = 'htd_token';
export const LOGIN_PATH = '/__htd_login';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 天

/** 令牌指纹（Cookie / 比对均使用指纹，不使用明文） */
export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    try {
      out[key] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch (error) {
      out[key] = part.slice(idx + 1).trim();
    }
  }
  return out;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function isHttps(req) {
  if (req.secure) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return proto === 'https';
}

function buildCookie(req) {
  const attrs = [
    `${COOKIE_NAME}=${hashToken(appConfig.accessToken)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE}`,
  ];
  if (isHttps(req)) attrs.push('Secure');
  return attrs.join('; ');
}

/**
 * 请求是否携带有效凭证（Cookie 或 Authorization: Bearer）
 */
export function isValidRequest(req) {
  const expected = hashToken(appConfig.accessToken);
  const cookieToken = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (cookieToken && safeEqual(cookieToken, expected)) return true;

  const auth = String(req.headers.authorization || '');
  if (/^bearer\s+/i.test(auth)) {
    const provided = auth.replace(/^bearer\s+/i, '').trim();
    if (provided && safeEqual(hashToken(provided), expected)) return true;
  }
  return false;
}

const LOGIN_PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>荒天帝工作台 · 访问验证</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: radial-gradient(1200px 600px at 20% -10%, #24304d 0%, transparent 60%), #12151c;
    font-family: "Sarasa Gothic SC", "Microsoft YaHei", system-ui, sans-serif; color: #e6e9f0;
  }
  .card {
    width: min(360px, calc(100vw - 32px)); padding: 28px 26px 24px;
    background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12);
    border-radius: 16px; box-shadow: 0 18px 50px rgba(0,0,0,.45);
    backdrop-filter: blur(14px) saturate(140%);
  }
  h1 { margin: 0 0 6px; font-size: 18px; letter-spacing: .5px; }
  p.sub { margin: 0 0 18px; font-size: 13px; color: #9aa4bd; line-height: 1.6; }
  input {
    width: 100%; padding: 11px 12px; font-size: 14px; color: #e6e9f0;
    background: rgba(0,0,0,.28); border: 1px solid rgba(255,255,255,.16);
    border-radius: 10px; outline: none;
  }
  input:focus { border-color: #5B8DEF; box-shadow: 0 0 0 3px rgba(91,141,239,.18); }
  button {
    width: 100%; margin-top: 12px; padding: 11px; font-size: 14px; font-weight: 700;
    color: #fff; background: #2F6BEE; border: 0; border-radius: 10px; cursor: pointer;
  }
  button:hover { background: #3d78f5; }
  button:disabled { opacity: .6; cursor: default; }
  .err { min-height: 18px; margin: 10px 0 0; font-size: 12px; color: #ff8f8f; }
  .hint { margin: 14px 0 0; font-size: 11px; color: #6f7891; line-height: 1.6; }
</style>
</head>
<body>
  <form class="card" id="f">
    <h1>荒天帝工作台</h1>
    <p class="sub">该实例已启用访问令牌，请输入后继续。</p>
    <input id="t" type="password" placeholder="访问令牌" autocomplete="current-password" autofocus>
    <button type="submit" id="b">进 入</button>
    <p class="err" id="e"></p>
    <p class="hint">令牌由启动环境变量 HTD_ACCESS_TOKEN 指定；验证后 30 天内免重复输入。</p>
  </form>
<script>
  var f = document.getElementById('f'), t = document.getElementById('t'),
      b = document.getElementById('b'), e = document.getElementById('e');
  f.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    e.textContent = ''; b.disabled = true; b.textContent = '验证中...';
    try {
      var r = await fetch('${LOGIN_PATH}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t.value })
      });
      var j = await r.json().catch(function () { return {}; });
      if (r.ok && j.success) { location.replace('/'); return; }
      e.textContent = j.message || '令牌不正确';
    } catch (err) {
      e.textContent = '网络异常，请重试';
    }
    b.disabled = false; b.textContent = '进 入'; t.select();
  });
</script>
</body>
</html>`;

export default function accessGuard(req, res, next) {
  if (!appConfig.accessToken) return next();

  // 登录提交：换取会话 Cookie
  if (req.method === 'POST' && req.path === LOGIN_PATH) {
    const provided = (req.body && (req.body.token || req.body.accessToken)) || '';
    if (provided && safeEqual(hashToken(provided), hashToken(appConfig.accessToken))) {
      res.setHeader('Set-Cookie', buildCookie(req));
      return res.json({ success: true });
    }
    return res.status(401).json({ success: false, message: '访问令牌不正确' });
  }

  if (isValidRequest(req)) return next();

  // 健康检查放行：信息量极小（服务名/版本），便于反向代理与守护脚本探活
  if (req.path === `${appConfig.apiPrefix}/system/health`) return next();

  // API 与登录接口：返回结构化 401，便于前端/脚本识别
  if (req.path.startsWith(appConfig.apiPrefix) || req.path === LOGIN_PATH) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: '需要访问令牌' });
  }

  // 页面请求给登录页；其余静态资源直接 401（避免把 HTML 当 JS 返回造成 MIME 错乱）
  const wantsHtml = String(req.headers.accept || '').includes('text/html');
  const hasExt = !!path.extname(req.path);
  if (wantsHtml || !hasExt) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).type('html').send(LOGIN_PAGE);
  }
  return res.status(401).type('text/plain; charset=utf-8').send('401 需要访问令牌');
}
