/**
 * V2-2 · 异地备份服务（可选，**默认完全关闭**）
 *
 * 为什么需要它：
 *   本地备份与数据库落在同一块磁盘上——磁盘故障、机器丢失、误格式化发生时，
 *   「数据库 + 全部本地备份」会同时消失。加密（V2-3）保护的是**机密性**，
 *   保护不了**可用性**；异地备份才是可用性防线。二者互补，不可互相替代。
 *
 * 设计取舍：
 *   - **默认关闭**：未配置 HTD_REMOTE_BACKUP_TARGET 时零网络请求、零行为变化，
 *     既有 513 个测试与纯本机用户完全不受影响。
 *   - **只上传，不下载**：远端仅作为备份目的地，不参与读取与恢复流程。
 *     恢复仍走本地备份，避免把「恢复」这一高危操作建立在网络可用性上。
 *   - **只管理自己命名的文件**：清理时仅匹配 `workbench_daily-*.db`
 *     （与本地策略一致：手动备份永久保留），绝不碰远端目录里的其它文件。
 *   - **不做删除远端再上传**：先写远端成功才更新本地状态，任何一步失败都
 *     不会让远端处于「比之前更差」的状态。
 *
 * 硬约束（改动此文件时请一并遵守）：
 *   1. 上传前必须校验 SQLite 魔数头——绝不用损坏的本地备份覆盖远端的好备份。
 *      这是本服务最危险的失败模式：本地损坏 → 同步 → 远端好备份被覆盖 → 全部丢失。
 *   2. 任何网络/配置异常都不得抛出到业务主流程（每日备份与写入请求都不能被拖垮）。
 *   3. getStatus() 绝不能返回 url / user / pass——状态会经 API 暴露给前端。
 *
 * 依赖注入（同 backup.service.js）：fs / path / appConfig / logger / clock / fetchImpl
 * 均可通过构造参数替换，便于用内存实现与本地 HTTP mock 做单测。
 */
import path from 'path';
import fs from 'fs';
import appConfig from '../../config/app.config.js';
import logger from '../../common/logger.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { encryptFile } from '../../lib/crypto.js';

const SQLITE_MAGIC = 'SQLite format 3\0'; // 16 字节文件头
const DAILY_PREFIX = 'workbench_daily-';
const DEFAULT_KEEP = 30;

// ===== WebDAV 辅助 =====

/**
 * 拼接 URL：容忍基地址带/不带尾斜杠，子目录片段各自去首尾斜杠。
 */
function joinUrl(base, ...parts) {
  const b = String(base || '').replace(/\/+$/, '');
  const rest = parts
    .filter(Boolean)
    .map((p) => String(p).replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return [b, ...rest].join('/');
}

function basicAuth(user, pass) {
  return `Basic ${Buffer.from(`${user || ''}:${pass || ''}`, 'utf8').toString('base64')}`;
}

/**
 * 从 PROPFIND 的 207 XML 中提取 href。
 * 各服务端命名空间前缀不一（d: / D: / 无前缀），故用宽容正则而非 XML 解析，
 * 避免为此引入 XML 依赖。
 */
function parsePropfindHrefs(xml) {
  const re = /<(?:\w+:)?href>([\s\S]*?)<\/(?:\w+:)?href>/gi;
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    let href = String(m[1] || '').trim();
    try { href = decodeURIComponent(href); } catch (_) { /* 保持原样 */ }
    out.push(href);
  }
  return out;
}

function baseNameOf(href) {
  return String(href).replace(/\/+$/, '').split('/').pop() || '';
}

// ===== 目标适配器 =====

const providers = {
  /** 本机另一块盘 / 已挂载的网络共享：无网络协议，最易验证 */
  local: {
    _dir(cfg, svc) {
      if (!cfg.path) {
        throw new BusinessError(
          ErrorCodes.REMOTE_BACKUP_CONFIG_INVALID,
          'local 目标需配置 HTD_REMOTE_BACKUP_PATH',
        );
      }
      return svc.path.join(cfg.path, cfg.dir || '');
    },
    async put(cfg, name, filePath, svc) {
      const dir = this._dir(cfg, svc);
      svc.fs.mkdirSync(dir, { recursive: true });
      svc.fs.copyFileSync(filePath, svc.path.join(dir, name));
    },
    async list(cfg, svc) {
      const dir = this._dir(cfg, svc);
      if (!svc.fs.existsSync(dir)) return [];
      return svc.fs.readdirSync(dir);
    },
    async remove(cfg, name, svc) {
      const p = svc.path.join(this._dir(cfg, svc), name);
      if (svc.fs.existsSync(p)) svc.fs.unlinkSync(p);
    },
  },

  /** WebDAV：PUT 上传 / PROPFIND 列举 / DELETE 清理 */
  webdav: {
    _auth(cfg) {
      if (!cfg.url) {
        throw new BusinessError(
          ErrorCodes.REMOTE_BACKUP_CONFIG_INVALID,
          'webdav 目标需配置 HTD_REMOTE_BACKUP_URL',
        );
      }
      return { Authorization: basicAuth(cfg.user, cfg.pass) };
    },
    async put(cfg, name, filePath, svc) {
      const headers = this._auth(cfg);
      const res = await svc.fetchImpl(joinUrl(cfg.url, cfg.dir, name), {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/octet-stream' },
        body: svc.fs.readFileSync(filePath),
      });
      if (!res.ok) {
        throw new BusinessError(
          ErrorCodes.REMOTE_BACKUP_UPLOAD_FAILED,
          `上传失败：HTTP ${res.status}`,
        );
      }
    },
    async list(cfg, svc) {
      const headers = this._auth(cfg);
      const res = await svc.fetchImpl(`${joinUrl(cfg.url, cfg.dir)}/`, {
        method: 'PROPFIND',
        headers: { ...headers, Depth: '1' },
      });
      if (!res.ok) {
        throw new BusinessError(
          ErrorCodes.REMOTE_BACKUP_LIST_FAILED,
          `列举远端失败：HTTP ${res.status}`,
        );
      }
      const xml = await res.text();
      return parsePropfindHrefs(xml)
        .map(baseNameOf)
        .filter((n) => n.endsWith('.db') || n.endsWith('.db.enc'));
    },
    async remove(cfg, name, svc) {
      const headers = this._auth(cfg);
      const res = await svc.fetchImpl(joinUrl(cfg.url, cfg.dir, name), {
        method: 'DELETE',
        headers,
      });
      // 404 视为已删除，不判失败（幂等）
      if (!res.ok && res.status !== 404) {
        throw new BusinessError(
          ErrorCodes.REMOTE_BACKUP_REMOVE_FAILED,
          `清理远端失败：HTTP ${res.status}`,
        );
      }
    },
  },
};

function stamp(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`
    + `_${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

class RemoteBackupService {
  constructor(deps = {}) {
    this.fs = deps.fs || fs;
    this.path = deps.path || path;
    this.appConfig = deps.appConfig || appConfig;
    this.logger = deps.logger || logger;
    this.clock = deps.clock || (() => Date.now());
    this.fetchImpl = deps.fetchImpl || globalThis.fetch;
    // V2-3 主密码（启用加密时由 server.js 注入）。非空 = 上传前先加密。
    this.passphrase = deps.passphrase || '';
    this._status = { state: 'idle', lastUploaded: null, lastError: null, at: null };
  }

  /**
   * 注入主密码（V2-3）。一旦注入，上传的将是加密副本而非明文库——
   * 否则「本地加密、异地明文」会让 V2-3 的保护彻底失效。
   */
  setPassphrase(passphrase) {
    this.passphrase = typeof passphrase === 'string' ? passphrase : '';
  }

  // ===== 配置 =====

  _cfg() {
    return this.appConfig.remoteBackup || {};
  }

  /**
   * 是否启用。**刻意以「是否配置了 target」为准，而非「target 是否受支持」**：
   * 若把不受支持的目标（如误配 s3、拼错 webdav）判定为「未启用」，服务会静默跳过，
   * 用户以为开了异地备份实则什么都没发生——这比直接报错危险得多。
   * 故：target 为空 = 用户未启用（零行为）；target 有值但不受支持 = 报错暴露。
   */
  isEnabled() {
    return !!(this._cfg().target);
  }

  _provider() {
    const cfg = this._cfg();
    const p = providers[cfg.target];
    if (!p) {
      throw new BusinessError(
        ErrorCodes.REMOTE_BACKUP_CONFIG_INVALID,
        `不支持的异地备份目标：${cfg.target || '(未配置)'}（可用：${Object.keys(providers).join(' / ')}）`,
      );
    }
    return p;
  }

  // ===== 状态持久化（记录「今天是否已同步」） =====

  _statePath() {
    return this.path.join(this.appConfig.dataRoot, 'remote-backup-state.json');
  }

  _readState() {
    try {
      return JSON.parse(this.fs.readFileSync(this._statePath(), 'utf8'));
    } catch (_) {
      return {};
    }
  }

  _writeState(state) {
    try {
      this.fs.writeFileSync(this._statePath(), JSON.stringify(state, null, 2));
    } catch (e) {
      this.logger.warn(`[异地备份] 写入状态失败: ${e.message}`);
    }
  }

  _setStatus(state, error = null, lastUploaded = this._status.lastUploaded) {
    this._status = {
      state,
      lastUploaded,
      lastError: error,
      at: new Date(this.clock()).toISOString(),
    };
  }

  // ===== 选取与校验 =====

  _newestBackupFile() {
    const dir = this.appConfig.backupDir;
    if (!this.fs.existsSync(dir)) return null;
    const files = this.fs.readdirSync(dir)
      .filter((f) => /^workbench_[^/\\]+\.db$/i.test(f))
      .map((f) => ({ f, stat: this.fs.statSync(this.path.join(dir, f)) }))
      // 次级排序用文件名而非仅 mtime：同一毫秒内创建的备份 mtime 相同，
      // 单纯按 mtime 排序结果不稳定（实测选到过非最新的一份）。
      // daily/manual 命名均含 YYYYMMDD_HHmmss，字典序即时间序，可作确定性 tiebreak。
      .sort((a, b) => (b.stat.mtimeMs - a.stat.mtimeMs) || (a.f < b.f ? 1 : (a.f > b.f ? -1 : 0)));
    if (!files.length) return null;
    return {
      fileName: files[0].f,
      filePath: this.path.join(dir, files[0].f),
      size: files[0].stat.size,
    };
  }

  _isSQLiteFile(filePath) {
    try {
      const fd = this.fs.openSync(filePath, 'r');
      const buf = Buffer.alloc(16);
      this.fs.readSync(fd, buf, 0, 16, 0);
      this.fs.closeSync(fd);
      return buf.toString('latin1') === SQLITE_MAGIC;
    } catch (_) {
      return false;
    }
  }

  // ===== 对外能力 =====

  /**
   * 上传最新一份本地备份到远端。
   * 约束①：远端文件名与本地同名，便于人工对应与手工恢复。
   * 约束②：上传前校验魔数头，损坏则拒绝（避免覆盖远端好备份）。
   */
  async uploadLatest() {
    if (!this.isEnabled()) return { skipped: true, reason: 'disabled' };
    const latest = this._newestBackupFile();
    if (!latest) return { skipped: true, reason: 'no-local-backup' };
    if (!this._isSQLiteFile(latest.filePath)) {
      this._setStatus('error', '最新本地备份损坏，已跳过上传', null);
      throw new BusinessError(
        ErrorCodes.BACKUP_CORRUPTED,
        '最新本地备份已损坏，已跳过异地上传（远端备份未被覆盖）',
      );
    }
    const cfg = this._cfg();
    const encrypted = !!this.passphrase;
    const remoteName = encrypted ? `${latest.fileName}.enc` : latest.fileName;
    // 加密副本落在数据目录内的临时文件，用完即删；绝不留在磁盘上形成第二份明文
    const tmpPath = encrypted
      ? this.path.join(this.appConfig.dataRoot, `.remote-upload-${Date.now()}.enc`)
      : null;
    try {
      this._setStatus('pending', null);
      if (encrypted) {
        encryptFile(latest.filePath, tmpPath, this.passphrase);
      }
      await this._provider().put(cfg, remoteName, tmpPath || latest.filePath, this);
    } catch (e) {
      this._setStatus('error', e.message, null);
      if (e instanceof BusinessError) throw e;
      throw new BusinessError(
        ErrorCodes.REMOTE_BACKUP_UPLOAD_FAILED,
        `异地备份上传失败：${e.message}`,
      );
    } finally {
      if (tmpPath) {
        try { this.fs.unlinkSync(tmpPath); } catch (_) { /* 已尽力清理 */ }
      }
    }
    this._setStatus('success', null, remoteName);
    return { uploaded: remoteName, size: latest.size, encrypted };
  }

  /**
   * 远端保留策略：仅清理 `workbench_daily-*.db`，手动备份永久保留（同本地策略）。
   * 排序依据文件名而非时间——daily 命名含 YYYYMMDD_HHmmss，字典序即时间序，
   * 且远端不保证返回可靠的 mtime。
   */
  async pruneRemote(keep) {
    if (!this.isEnabled()) return { removed: [], kept: 0 };
    const cfg = this._cfg();
    const k = keep ?? cfg.keep ?? DEFAULT_KEEP;
    let items = [];
    try {
      items = await this._provider().list(cfg, this);
    } catch (e) {
      if (e instanceof BusinessError) throw e;
      throw new BusinessError(
        ErrorCodes.REMOTE_BACKUP_LIST_FAILED,
        `异地备份列举失败：${e.message}`,
      );
    }
    const owned = items
      .filter((n) => typeof n === 'string'
        && n.startsWith(DAILY_PREFIX)
        && (n.endsWith('.db') || n.endsWith('.db.enc')))
      .sort();
    const excess = owned.slice(0, Math.max(0, owned.length - k));
    const removed = [];
    for (const name of excess) {
      try {
        await this._provider().remove(cfg, name, this);
        removed.push(name);
      } catch (e) {
        // 单个删除失败不中断整体清理，也不算作同步失败
        this.logger.warn(`[异地备份] 清理失败 ${name}: ${e.message}`);
      }
    }
    return { removed, kept: owned.length - removed.length };
  }

  /** 上传 + 清理，并落盘「今日已同步」标记 */
  async syncLatest() {
    const today = stamp(new Date(this.clock())).slice(0, 8);
    const res = await this.uploadLatest();
    if (!res.skipped) {
      const pruned = await this.pruneRemote();
      res.pruned = pruned.removed.length;
    }
    this._writeState({
      ...this._readState(),
      lastSyncDate: today,
      lastUploaded: res.uploaded || null,
      lastError: null,
    });
    return res;
  }

  /** 每天最多同步一次（与本地每日备份节奏一致） */
  async maybeSync() {
    if (!this.isEnabled()) return { skipped: true, reason: 'disabled' };
    const state = this._readState();
    const today = stamp(new Date(this.clock())).slice(0, 8);
    if (state.lastSyncDate === today) return { skipped: true, reason: 'already-synced-today' };
    return this.syncLatest();
  }

  /**
   * 供每日备份后调用：fire-and-forget，任何失败都只记录不抛出。
   * 这是「网络问题绝不能拖垮业务写入」这条约束的落地处。
   */
  maybeSyncFireAndForget() {
    if (!this.isEnabled()) return;
    this.maybeSync().catch((e) => {
      this._writeState({ ...this._readState(), lastError: e.message });
      this.logger.warn(`[异地备份] 同步失败：${e.message}`);
    });
  }

  /** 连通性自检（配置校验用）：能列举远端目录即视为可用 */
  async check() {
    if (!this.isEnabled()) {
      return { ok: false, message: '异地备份未启用（未配置 HTD_REMOTE_BACKUP_TARGET）' };
    }
    try {
      const items = await this._provider().list(this._cfg(), this);
      return { ok: true, message: `连接正常，远端已有 ${items.length} 个备份文件` };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  /** 状态快照：绝不返回 url / user / pass */
  getStatus() {
    const cfg = this._cfg();
    return {
      enabled: this.isEnabled(),
      target: cfg.target || '',
      dir: cfg.dir || '',
      keep: cfg.keep ?? DEFAULT_KEEP,
      // 上传前是否加密（由 V2-3 主密码是否注入决定）
      encrypted: !!this.passphrase,
      ...this._status,
    };
  }
}

export function createRemoteBackupService(deps = {}) {
  return new RemoteBackupService(deps);
}

export default createRemoteBackupService();
