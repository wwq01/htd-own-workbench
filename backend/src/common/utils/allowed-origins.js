/**
 * 访问来源白名单解析（S4 服务端部署）
 *
 * 背景：此前「允许的来源」在三处各写一份（CORS 白名单、originGuard、启动日志），
 * 且全部硬编码为回环地址。服务端部署后来源随部署形态变化（本机 / 局域网 / 域名），
 * 三处若不同步会出现「页面能开、一保存就 403」这类难排查的问题（与端口顺延 403
 * 同源）。故收敛为单一来源，CORS 与 originGuard 共用。
 *
 * 组成：
 *   1. 回环地址（127.0.0.1 / localhost）——始终放行，保证本机模式零回归
 *   2. HTD_ALLOWED_ORIGINS 显式配置（逗号分隔，可写域名）
 *   3. HTD_LAN=1 时，本机全部非回环 IPv4（DHCP 换 IP 也不失效）
 *   4. `*` 通配：放行任意来源（仅建议与访问令牌/反向代理配合使用）
 *
 * 注意：白名单按「请求时」动态计算而非启动时固化——端口会在 listen 后回写
 * （17388 被占则顺延），固化会把顺延后的端口判为非法来源。
 */
import os from 'os';
import appConfig from '../../config/app.config.js';

/** 通配标记：显式配置 `*` 时放行任意来源 */
export const WILDCARD = '*';

/**
 * 本机非回环 IPv4 地址列表
 */
export function localIpv4() {
  const addresses = [];
  let interfaces = {};
  try {
    interfaces = os.networkInterfaces() || {};
  } catch (error) {
    return addresses;
  }
  for (const list of Object.values(interfaces)) {
    for (const ni of list || []) {
      const isV4 = ni.family === 'IPv4' || ni.family === 4;
      if (isV4 && !ni.internal) addresses.push(ni.address);
    }
  }
  return addresses;
}

/**
 * 计算当前允许的来源集合
 * @returns {Set<string>} 完整 URL 形态（scheme://host:port）
 */
export function resolveAllowedOrigins() {
  const port = appConfig.port;
  const allowed = new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
  ]);

  // 绑定具体网卡时，该网卡地址本身也是合法来源（0.0.0.0 / :: 是通配绑定，不作为来源）
  const host = String(appConfig.host || '').trim();
  if (host && host !== '0.0.0.0' && host !== '::' && host !== '*') {
    allowed.add(`http://${host}:${port}`);
  }

  if (appConfig.lan) {
    for (const ip of localIpv4()) allowed.add(`http://${ip}:${port}`);
  }

  for (const origin of appConfig.allowedOrigins || []) {
    allowed.add(origin);
  }

  return allowed;
}

/**
 * 判断来源是否放行
 * @param {string|undefined} origin 请求的 Origin 头；同源请求（无 Origin）视为放行
 * @param {Set<string>} [allowedSet] 便于测试注入，缺省则实时计算
 */
export function isOriginAllowed(origin, allowedSet) {
  if (!origin) return true; // 同源请求 / 非浏览器调用不带 Origin
  const allowed = allowedSet || resolveAllowedOrigins();
  if (allowed.has(WILDCARD)) return true;
  return allowed.has(origin);
}
