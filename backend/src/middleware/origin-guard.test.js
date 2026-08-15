/**
 * Origin 校验中间件测试（纯逻辑，无需 supertest）
 * 仅写入类请求（POST/PUT/PATCH/DELETE）校验 Origin；
 * GET/HEAD/OPTIONS 直接放行；非本地源返回 403。
 */
import { describe, it, expect } from 'vitest';
import originGuard from './origin-guard.js';
import { ErrorCodes } from '../common/constants/index.js';

function run(method, origin) {
  const req = { method, headers: { origin } };
  let status = null;
  let jsonBody = null;
  const res = {
    status(code) { status = code; return this; },
    json(body) { jsonBody = body; return this; },
  };
  let passed = false;
  let errored = null;
  const next = (err) => { if (err) { errored = err; jsonBody = err.toPublic ? err.toPublic() : err; } else { passed = true; } };
  originGuard(req, res, next);
  return { status, jsonBody, passed, errored };
}

describe('originGuard', () => {
  it('GET 请求不校验直接放行', () => {
    const r = run('GET', 'http://evil.com');
    expect(r.passed).toBe(true);
    expect(r.status).toBeNull();
  });

  it('同源（无 Origin）POST 放行', () => {
    const r = run('POST', undefined);
    expect(r.passed).toBe(true);
  });

  it('本地 127.0.0.1 Origin POST 放行', () => {
    const r = run('POST', 'http://127.0.0.1:17388');
    expect(r.passed).toBe(true);
  });

  it('localhost Origin POST 放行', () => {
    const r = run('POST', 'http://localhost:17388');
    expect(r.passed).toBe(true);
  });

  it('非本地 Origin POST 拒绝 + ORIGIN_FORBIDDEN（由 errorHandler 统一设 403）', () => {
    const r = run('POST', 'http://evil.com');
    expect(r.passed).toBe(false);
    expect(r.errored).toBeTruthy();
    expect(r.jsonBody.code).toBe(ErrorCodes.ORIGIN_FORBIDDEN);
  });

  it('DELETE 非本地源同样拒绝', () => {
    const r = run('DELETE', 'http://attacker.test');
    expect(r.passed).toBe(false);
    expect(r.errored).toBeTruthy();
    expect(r.jsonBody.code).toBe(ErrorCodes.ORIGIN_FORBIDDEN);
  });
});
