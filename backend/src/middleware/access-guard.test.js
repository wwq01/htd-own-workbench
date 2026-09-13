/**
 * 访问令牌门禁测试（S4 服务端部署）
 *
 * 覆盖两条主线：
 * 1. 未设置令牌时完全放行（保证既有本机模式零回归）
 * 2. 设置令牌后的放行/拦截/登录/凭证形态（Cookie、Bearer、health 例外）
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import accessGuard, { isValidRequest, hashToken, LOGIN_PATH } from './access-guard.js';
import appConfig from '../config/app.config.js';

const TOKEN = 's3cret-token-测试';

function run({ method = 'GET', path = '/', headers = {}, body = {} } = {}) {
  const req = { method, path, headers, body };
  const out = { status: null, json: null, sent: null, type: null, resHeaders: {}, nextCalled: false };
  const res = {
    status(code) { out.status = code; return this; },
    json(payload) { out.json = payload; return this; },
    send(payload) { out.sent = payload; return this; },
    type(t) { out.type = t; return this; },
    setHeader(k, v) { out.resHeaders[k] = v; return this; },
  };
  accessGuard(req, res, (err) => { out.nextCalled = !err; });
  return out;
}

describe('accessGuard', () => {
  let original = null;

  beforeEach(() => {
    original = appConfig.accessToken;
  });

  afterEach(() => {
    appConfig.accessToken = original;
  });

  it('未设置访问令牌时全部放行（本机模式零回归）', () => {
    appConfig.accessToken = '';
    expect(run({ method: 'POST', path: '/api/v1/todos' }).nextCalled).toBe(true);
    expect(run({ path: '/' }).nextCalled).toBe(true);
  });

  it('启用令牌后：无凭证的 API 请求返回 401 JSON', () => {
    appConfig.accessToken = TOKEN;
    const r = run({ method: 'GET', path: '/api/v1/todos', headers: { accept: 'application/json' } });
    expect(r.nextCalled).toBe(false);
    expect(r.status).toBe(401);
    expect(r.json.code).toBe('UNAUTHORIZED');
  });

  it('启用令牌后：页面请求返回内置登录页（自包含 HTML）', () => {
    appConfig.accessToken = TOKEN;
    const r = run({ path: '/', headers: { accept: 'text/html' } });
    expect(r.nextCalled).toBe(false);
    expect(r.status).toBe(200);
    expect(String(r.sent)).toContain('荒天帝工作台');
    expect(String(r.sent)).toContain(LOGIN_PATH);
  });

  it('启用令牌后：静态资源请求返回 401 文本（不返回 HTML，避免 MIME 错乱）', () => {
    appConfig.accessToken = TOKEN;
    const r = run({ path: '/assets/app.js', headers: { accept: '*/*' } });
    expect(r.status).toBe(401);
    expect(String(r.sent)).toContain('401');
  });

  it('Cookie 持有令牌指纹时放行，且 Cookie 中不含明文令牌', () => {
    appConfig.accessToken = TOKEN;
    const cookie = `htd_token=${hashToken(TOKEN)}`;
    expect(run({ path: '/', headers: { cookie } }).nextCalled).toBe(true);
    expect(cookie).not.toContain(TOKEN);
  });

  it('Authorization: Bearer 携带明文令牌时放行（便于脚本/健康检查）', () => {
    appConfig.accessToken = TOKEN;
    expect(run({ path: '/api/v1/todos', headers: { authorization: `Bearer ${TOKEN}` } }).nextCalled).toBe(true);
  });

  it('错误令牌不放行', () => {
    appConfig.accessToken = TOKEN;
    expect(run({ path: '/api/v1/todos', headers: { authorization: 'Bearer wrong' } }).nextCalled).toBe(false);
    expect(run({ path: '/', headers: { cookie: `htd_token=${hashToken('wrong')}` } }).nextCalled).toBe(false);
  });

  it('健康检查例外放行（便于反向代理与守护脚本探活）', () => {
    appConfig.accessToken = TOKEN;
    expect(run({ path: '/api/v1/system/health' }).nextCalled).toBe(true);
  });

  it('登录接口：正确令牌下发 HttpOnly Cookie', () => {
    appConfig.accessToken = TOKEN;
    const r = run({ method: 'POST', path: LOGIN_PATH, body: { token: TOKEN } });
    expect(r.status).toBeNull();
    expect(r.json.success).toBe(true);
    const cookie = r.resHeaders['Set-Cookie'];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain(hashToken(TOKEN));
  });

  it('登录接口：错误令牌返回 401 且不下发 Cookie', () => {
    appConfig.accessToken = TOKEN;
    const r = run({ method: 'POST', path: LOGIN_PATH, body: { token: 'bad' } });
    expect(r.status).toBe(401);
    expect(r.resHeaders['Set-Cookie']).toBeUndefined();
  });

  it('isValidRequest 可直接用于其他中间件复用', () => {
    appConfig.accessToken = TOKEN;
    expect(isValidRequest({ headers: { authorization: `bearer ${TOKEN}` } })).toBe(true);
    expect(isValidRequest({ headers: {} })).toBe(false);
  });
});
