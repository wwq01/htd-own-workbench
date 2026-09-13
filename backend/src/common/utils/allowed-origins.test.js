/**
 * 来源白名单解析测试（S4 服务端部署）
 *
 * 重点锁死两条易回归的行为：
 * 1. 端口顺延后白名单必须同步（否则页面能开、一保存就 403）
 * 2. 未显式放行时，外部来源必须被拒绝（不能因支持部署而放开默认边界）
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveAllowedOrigins, isOriginAllowed, localIpv4, WILDCARD } from './allowed-origins.js';
import appConfig from '../../config/app.config.js';

describe('allowed-origins', () => {
  let snapshot = null;

  beforeEach(() => {
    snapshot = {
      port: appConfig.port,
      host: appConfig.host,
      lan: appConfig.lan,
      allowedOrigins: appConfig.allowedOrigins,
    };
    appConfig.port = 17388;
    appConfig.host = '127.0.0.1';
    appConfig.lan = false;
    appConfig.allowedOrigins = [];
  });

  afterEach(() => {
    Object.assign(appConfig, snapshot);
  });

  it('回环地址始终放行（本机模式零回归）', () => {
    const allowed = resolveAllowedOrigins();
    expect(allowed.has('http://127.0.0.1:17388')).toBe(true);
    expect(allowed.has('http://localhost:17388')).toBe(true);
  });

  it('端口顺延后白名单同步更新（避免顺延后写入 403）', () => {
    appConfig.port = 17390;
    const allowed = resolveAllowedOrigins();
    expect(allowed.has('http://127.0.0.1:17390')).toBe(true);
    expect(allowed.has('http://127.0.0.1:17388')).toBe(false);
  });

  it('同源请求（无 Origin 头）视为放行', () => {
    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed('')).toBe(true);
  });

  it('未配置时拒绝外部来源（默认安全边界不变）', () => {
    expect(isOriginAllowed('http://evil.test')).toBe(false);
  });

  it('显式配置的来源放行（支持域名与自定义端口）', () => {
    appConfig.allowedOrigins = ['https://htd.example.com', 'http://192.168.1.10:17388'];
    expect(isOriginAllowed('https://htd.example.com')).toBe(true);
    expect(isOriginAllowed('http://192.168.1.10:17388')).toBe(true);
    expect(isOriginAllowed('https://other.example.com')).toBe(false);
  });

  it('LAN 模式自动纳入本机全部非回环 IPv4（DHCP 换 IP 不失效）', () => {
    appConfig.lan = true;
    const ips = localIpv4();
    const allowed = resolveAllowedOrigins();
    for (const ip of ips) {
      expect(allowed.has(`http://${ip}:${appConfig.port}`)).toBe(true);
    }
    expect(isOriginAllowed(`http://${ips[0]}:${appConfig.port}`)).toBe(true);
  });

  it('通配 * 放行任意来源（需显式配置，不会默认开启）', () => {
    appConfig.allowedOrigins = [WILDCARD];
    expect(isOriginAllowed('http://anywhere.test')).toBe(true);
  });

  it('绑定 0.0.0.0 时不把 0.0.0.0 当作来源（它是通配绑定而非可访问地址）', () => {
    appConfig.host = '0.0.0.0';
    const allowed = resolveAllowedOrigins();
    expect(allowed.has('http://0.0.0.0:17388')).toBe(false);
    expect(allowed.has('http://127.0.0.1:17388')).toBe(true);
  });

  it('绑定具体网卡地址时，该地址本身也是合法来源', () => {
    appConfig.host = '192.168.1.10';
    expect(resolveAllowedOrigins().has('http://192.168.1.10:17388')).toBe(true);
  });
});
