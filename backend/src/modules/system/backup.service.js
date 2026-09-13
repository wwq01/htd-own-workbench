/**
 * SQLite 整库备份服务（V1.2 升级）
 *
 * 能力：
 *  - 每日自动备份（懒触发，无 cron）：maybeDailyBackup() 检查当日是否已备份，未则补一份
 *  - 手动备份 + 可选备注命名
 *  - 30 份保留策略（仅清理每日备份，手动备份永久保留）
 *  - 恢复前安全快照（先备份当前主库再覆盖，选错可回退）
 *  - 损坏拒绝（SQLite 魔数头校验）+ 版本过高拒绝（侧车 .meta.json 记录 schemaVersion）
 *
 * 设计取舍（如实说明）：
 *  项目未引入 better-sqlite3 / sqlite3，无法对「任意备份文件」跑 PRAGMA integrity_check。
 *  改用等价且离线安全的方案：① 魔数头 `SQLite format 3\0` 校验防损坏；
 *  ② 每份备份附带 `xxx.meta.json` 记录 { schemaVersion, type, note }，恢复前比对版本。
 *  未来若引入 SQLite 读取库，可升级为读取备份内 `_schema_version` 表。
 *
 * 依赖注入：所有外部依赖（fs / path / appConfig / eventBus / logger / clock / prisma）
 * 均通过构造参数注入，便于单元测试用 mock 替换（5.3e.5 Runner 工厂思想）。
 */
import path from 'path';
import fs from 'fs';
import appConfig from '../../config/app.config.js';
import { formatSize } from '../../common/utils/file.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { eventBus } from '../../lib/observable.js';
import logger from '../../common/logger.js';

const APP_SCHEMA_VERSION = 2; // V1.2 起备份版本标记
const SQLITE_MAGIC = 'SQLite format 3\0'; // 16 字节文件头
const DAILY_KEEP = 30;

/**
 * 安全文件名：仅允许 workbench_*.db，且不含路径分隔符（防遍历）
 */
function isSafeBackupFileName(fileName) {
  return typeof fileName === 'string'
    && /^workbench_[^/\\]+\.db$/i.test(fileName)
    && path.basename(fileName) === fileName;
}

/**
 * 生成 YYYYMMDD_HHmmss 时间戳
 */
function stamp(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`
    + `_${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

class BackupService {
  constructor(deps = {}) {
    this.fs = deps.fs || fs;
    this.path = deps.path || path;
    this.appConfig = deps.appConfig || appConfig;
    this.eventBus = deps.eventBus || eventBus;
    this.logger = deps.logger || logger;
    this.clock = deps.clock || (() => Date.now());
    this.prisma = deps.prisma || null; // 可选：恢复后 $disconnect 以重连新库
    this.remote = deps.remote || null; // 可选：V2-2 异地备份服务（未注入则完全跳过）
    // 运行时备份状态（顶栏状态点数据源）
    this._status = { status: 'idle', error: null, at: null };
    this._failStreak = 0;
  }

  // ===== 内部工具 =====

  _backupDir() {
    return this.appConfig.backupDir;
  }

  _ensureDir(dir) {
    if (!this.fs.existsSync(dir)) this.fs.mkdirSync(dir, { recursive: true });
  }

  _metaPath(fileName) {
    return this.path.join(this._backupDir(), fileName.replace(/\.db$/, '.meta.json'));
  }

  _writeMeta(fileName, meta) {
    try {
      this._ensureDir(this._backupDir());
      this.fs.writeFileSync(this._metaPath(fileName), JSON.stringify({ schemaVersion: APP_SCHEMA_VERSION, ...meta }, null, 2));
    } catch (e) {
      // meta 非关键，记录但不阻断主流程
      this.logger.warn(`[备份] 写入 meta 失败: ${e.message}`);
    }
  }

  _readMeta(fileName) {
    try {
      return JSON.parse(this.fs.readFileSync(this._metaPath(fileName), 'utf8'));
    } catch (e) {
      return null;
    }
  }

  _setStatus(status, error = null) {
    this._status = { status, error, at: new Date(this.clock()).toISOString() };
    if (status === 'error') {
      this._failStreak += 1;
    } else if (status === 'success' || status === 'saved') {
      this._failStreak = 0;
    }
    this.eventBus.emit('backup:status', { ...this._status });
  }

  _resolveBackupPath(fileName) {
    if (!isSafeBackupFileName(fileName)) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, '备份文件名无效');
    }
    return this.path.join(this._backupDir(), fileName);
  }

  // ===== 校验 =====

  /**
   * 校验 SQLite 文件头完整性（魔数头）。损坏返回 false。
   */
  _isSQLiteFile(filePath) {
    try {
      const fd = this.fs.openSync(filePath, 'r');
      const buf = Buffer.alloc(16);
      this.fs.readSync(fd, buf, 0, 16, 0);
      this.fs.closeSync(fd);
      return buf.toString('latin1') === SQLITE_MAGIC;
    } catch (e) {
      return false;
    }
  }

  /**
   * 校验备份版本：meta.schemaVersion > 当前运行版本则拒绝。
   * 无 meta 视为旧版（v1），允许恢复。
   */
  _checkVersionAllowed(meta) {
    if (meta && typeof meta.schemaVersion === 'number' && meta.schemaVersion > APP_SCHEMA_VERSION) {
      throw new BusinessError(
        ErrorCodes.BACKUP_VERSION_TOO_HIGH,
        `备份由更高版本（v${meta.schemaVersion}）创建，请先升级工作台再恢复此备份`,
      );
    }
  }

  // ===== 创建 =====

  async _copyMainTo(filePath) {
    if (!this.fs.existsSync(this.appConfig.dbPath)) {
      throw new BusinessError(ErrorCodes.FILE_NOT_FOUND, '数据库文件不存在，暂时无法备份');
    }
    this._ensureDir(this.path.dirname(filePath));
    this.fs.copyFileSync(this.appConfig.dbPath, filePath);
  }

  async _createWithPrefix(prefix, note) {
    const date = new Date(this.clock());
    const base = note ? `${prefix}${note}-${stamp(date)}` : `${prefix}${stamp(date)}`;
    let fileName = `${base}.db`;
    let i = 1;
    while (this.fs.existsSync(this.path.join(this._backupDir(), fileName))) {
      fileName = `${base}_${i++}.db`;
    }
    const filePath = this.path.join(this._backupDir(), fileName);
    try {
      this._setStatus('pending');
      await this._copyMainTo(filePath);
      const type = prefix.startsWith('workbench_daily') ? 'daily' : 'manual';
      this._writeMeta(fileName, { type, note: note || null, createdAt: new Date(this.clock()).toISOString() });
      const stat = this.fs.statSync(filePath);
      this._setStatus('success');
      this.eventBus.emit('backup:created', { fileName, type });
      return this._describe(fileName, stat, type, note);
    } catch (e) {
      this._setStatus('error', e.message);
      if (e instanceof BusinessError) throw e;
      throw new BusinessError(ErrorCodes.BACKUP_CREATE_FAILED, `备份创建失败：${e.message}`);
    }
  }

  /**
   * 手动备份（兼容旧 POST /backups，无备注）
   */
  async createBackup() {
    return this.createManualBackup();
  }

  /**
   * 手动备份 + 可选备注命名
   * POST /api/backups/manual  { note?: string }
   */
  async createManualBackup(note) {
    const safeNote = note ? String(note).replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) : '';
    return this._createWithPrefix('workbench_manual-', safeNote);
  }

  /**
   * 每日自动备份（懒触发）
   */
  async createDailyBackup() {
    return this._createWithPrefix('workbench_daily-', '');
  }

  /**
   * 写入类请求成功后调用：若当日尚未备份则补一份（fire-and-forget）
   */
  async maybeDailyBackup() {
    if (this.isDailyToday()) return;
    await this.createDailyBackup();
    this.pruneDailyBackups(DAILY_KEEP);
    this._syncRemote();
  }

  /**
   * 每日备份后异步触发异地同步（V2-2）。
   * 刻意不 await：远端可能在 NAS/公网，网络抖动与超时绝不能拖慢写入请求。
   * 同步内部的失败只写状态与日志，不会冒泡到这里。
   */
  _syncRemote() {
    if (!this.remote || typeof this.remote.maybeSyncFireAndForget !== 'function') return;
    try {
      this.remote.maybeSyncFireAndForget();
    } catch (e) {
      this.logger.warn(`[备份] 异地同步启动失败: ${e.message}`);
    }
  }

  isDailyToday() {
    const today = stamp(new Date(this.clock())).slice(0, 8);
    const prefix = `workbench_daily-${today}`;
    return this.fs.readdirSync(this._backupDir())
      .some((f) => f.startsWith(prefix) && f.endsWith('.db'));
  }

  // ===== 保留策略 =====

  /**
   * 仅保留最近 keep 份每日备份，超出删除最旧的每日备份（手动备份不删）
   */
  pruneDailyBackups(keep = DAILY_KEEP) {
    const daily = this.fs.readdirSync(this._backupDir())
      .filter((f) => f.startsWith('workbench_daily-') && f.endsWith('.db'))
      .map((f) => ({ f, stat: this.fs.statSync(this.path.join(this._backupDir(), f)) }))
      .sort((a, b) => a.stat.mtimeMs - b.stat.mtimeMs);
    const excess = daily.slice(0, Math.max(0, daily.length - keep));
    for (const { f } of excess) {
      try {
        this.fs.unlinkSync(this.path.join(this._backupDir(), f));
        const meta = this._metaPath(f);
        if (this.fs.existsSync(meta)) this.fs.unlinkSync(meta);
      } catch (e) {
        this.logger.warn(`[备份] 清理旧每日备份失败 ${f}: ${e.message}`);
      }
    }
    return excess.length;
  }

  // ===== 列表 =====

  /**
   * 列出所有备份（按时间倒序），含类型 / 备注 / 版本
   */
  async listBackups() {
    this._ensureDir(this._backupDir());
    return this.fs.readdirSync(this._backupDir())
      .filter(isSafeBackupFileName)
      .map((fileName) => {
        const stat = this.fs.statSync(this.path.join(this._backupDir(), fileName));
        const meta = this._readMeta(fileName);
        const type = meta?.type || (fileName.startsWith('workbench_daily-') ? 'daily' : 'manual');
        return this._describe(fileName, stat, type, meta?.note, meta?.schemaVersion);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  _describe(fileName, stat, type, note, schemaVersion) {
    return {
      fileName,
      type,
      note: note || null,
      schemaVersion: schemaVersion ?? null,
      size: stat.size,
      sizeText: formatSize(stat.size),
      createdAt: (stat.birthtime && stat.birthtime.getTime?.() !== 0)
        ? stat.birthtime.toISOString()
        : stat.mtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    };
  }

  // ===== 删除 =====

  getBackupPath(fileName) {
    const filePath = this._resolveBackupPath(fileName);
    if (!this.fs.existsSync(filePath)) {
      throw new BusinessError(ErrorCodes.BACKUP_FILE_NOT_FOUND, '备份文件不存在');
    }
    return filePath;
  }

  async removeBackup(fileName) {
    const filePath = this._resolveBackupPath(fileName);
    this.fs.unlinkSync(filePath);
    const meta = this._metaPath(fileName);
    if (this.fs.existsSync(meta)) this.fs.unlinkSync(meta);
    this.eventBus.emit('backup:removed', { fileName });
    return { fileName };
  }

  // ===== 恢复（含安全快照 + 校验） =====

  /**
   * 恢复指定备份：
   *  1) 校验损坏（魔数头）+ 版本过高
   *  2) 恢复前先对当前主库做安全快照
   *  3) 复制备份覆盖主库
   *  4) 若注入 prisma，则 $disconnect 让下次查询重连新库
   */
  async restoreBackup(fileName) {
    const backupPath = this._resolveBackupPath(fileName);
    if (!this.fs.existsSync(backupPath)) {
      throw new BusinessError(ErrorCodes.BACKUP_FILE_NOT_FOUND, '备份文件不存在');
    }
    // ① 损坏校验
    if (!this._isSQLiteFile(backupPath)) {
      throw new BusinessError(ErrorCodes.BACKUP_CORRUPTED, '备份文件已损坏，无法恢复（已保留原主库）');
    }
    // ① 版本校验
    this._checkVersionAllowed(this._readMeta(fileName));

    // ② 恢复前安全快照
    const snapName = `workbench_pre-restore-${stamp(new Date(this.clock()))}.db`;
    const snapPath = this.path.join(this._backupDir(), snapName);
    try {
      this.fs.copyFileSync(this.appConfig.dbPath, snapPath);
      this._writeMeta(snapName, { type: 'pre-restore', note: fileName, createdAt: new Date(this.clock()).toISOString() });
    } catch (e) {
      throw new BusinessError(ErrorCodes.BACKUP_RESTORE_FAILED, `恢复前快照失败：${e.message}`);
    }

    // ③ 覆盖主库
    try {
      this.fs.copyFileSync(backupPath, this.appConfig.dbPath);
    } catch (e) {
      // 覆盖失败：尽量回滚快照
      try { this.fs.copyFileSync(snapPath, this.appConfig.dbPath); } catch (_) { /* ignore */ }
      throw new BusinessError(ErrorCodes.BACKUP_RESTORE_FAILED, `恢复覆盖失败：${e.message}`);
    }

    // ④ 重连（可选）
    if (this.prisma && typeof this.prisma.$disconnect === 'function') {
      try { await this.prisma.$disconnect(); } catch (_) { /* ignore */ }
    }

    this.eventBus.emit('backup:restored', { fileName, snapshot: snapName });
    return { fileName, snapshot: snapName };
  }

  // ===== 状态 =====

  /**
   * 顶栏状态点数据源：idle / pending / success / error
   * 连续失败 3 次自动暂停自动备份
   */
  getStatus() {
    const autoPaused = this._failStreak >= 3;
    return { ...this._status, autoPaused, failStreak: this._failStreak };
  }
}

/**
 * 备份 Runner 工厂（5.3e.5）：所有外部依赖注入，便于测试替换
 */
export function createBackupService(deps = {}) {
  return new BackupService(deps);
}

export default createBackupService();
