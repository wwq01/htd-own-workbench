/**
 * 系统模块 - 控制层
 */
import systemService from './system.service.js';
import dataService from './data.service.js';
import backupService from './backup.service.js';
import remoteBackupService from './remote-backup.service.js';
import settingsService from './settings.service.js';
import fieldConfigService from './fieldConfig.service.js';

class SystemController {
  /**
   * 健康检查
   * GET /api/v1/system/health
   */
  async healthCheck(req, res, next) {
    try {
      const data = await systemService.healthCheck();
      res.success(data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * 全局统计数据
   * GET /api/v1/system/statistics
   */
  async getStatistics(req, res, next) {
    try {
      const data = await systemService.getStatistics();
      res.success(data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * 各模块数据条目统计
   * GET /api/v1/system/data-stats
   */
  async getDataStats(req, res, next) {
    try {
      const data = await systemService.getDataStats();
      res.success(data);
    } catch (err) {
      next(err);
    }
  }

  async exportData(req, res, next) {
    try {
      const data = await dataService.exportAll();
      res.success(data);
    } catch (err) {
      next(err);
    }
  }

  async importData(req, res, next) {
    try {
      const data = await dataService.importAll(req.body);
      res.success(data);
    } catch (err) {
      next(err);
    }
  }

  async clearData(req, res, next) {
    try {
      const data = await dataService.clearAll(req.body);
      res.success(data);
    } catch (err) {
      next(err);
    }
  }

  async listBackups(req, res, next) {
    try {
      res.success(await backupService.listBackups());
    } catch (err) {
      next(err);
    }
  }

  async createBackup(req, res, next) {
    try {
      res.success(await backupService.createBackup());
    } catch (err) {
      next(err);
    }
  }

  async createManualBackup(req, res, next) {
    try {
      const note = req.body && req.body.note ? String(req.body.note) : '';
      res.success(await backupService.createManualBackup(note));
    } catch (err) {
      next(err);
    }
  }

  async restoreBackup(req, res, next) {
    try {
      res.success(await backupService.restoreBackup(req.params.fileName));
    } catch (err) {
      next(err);
    }
  }

  async getBackupStatus(req, res, next) {
    try {
      res.success(backupService.getStatus());
    } catch (err) {
      next(err);
    }
  }

  /**
   * 异地备份状态（V2-2，默认关闭）
   * GET /api/v1/system/backups/remote
   * 注意：不返回 url / user / pass，仅回显目标类型与目录，避免凭据经 API 泄露。
   */
  async getRemoteBackupStatus(req, res, next) {
    try {
      res.success(remoteBackupService.getStatus());
    } catch (err) {
      next(err);
    }
  }

  /**
   * 异地备份连通性自检
   * POST /api/v1/system/backups/remote/check
   */
  async checkRemoteBackup(req, res, next) {
    try {
      res.success(await remoteBackupService.check());
    } catch (err) {
      next(err);
    }
  }

  /**
   * 立即同步一次异地备份（忽略「今日已同步」节流）
   * POST /api/v1/system/backups/remote/sync
   */
  async syncRemoteBackup(req, res, next) {
    try {
      res.success(await remoteBackupService.syncLatest());
    } catch (err) {
      next(err);
    }
  }

  async downloadBackup(req, res, next) {
    try {
      const filePath = backupService.getBackupPath(req.params.fileName);
      res.download(filePath, req.params.fileName, (err) => {
        if (err && !res.headersSent) next(err);
      });
    } catch (err) {
      next(err);
    }
  }

  async removeBackup(req, res, next) {
    try {
      res.success(await backupService.removeBackup(req.params.fileName));
    } catch (err) {
      next(err);
    }
  }

  async getSettings(req, res, next) {
    try {
      res.success(await settingsService.getSettings());
    } catch (err) {
      next(err);
    }
  }

  async updateSettings(req, res, next) {
    try {
      res.success(await settingsService.updateSettings(req.body));
    } catch (err) {
      next(err);
    }
  }

  /**
   * 字段 / 状态机配置平台 - 读取
   * GET /api/v1/system/field-config
   */
  async getFieldConfig(req, res, next) {
    try {
      res.success(await fieldConfigService.getConfig());
    } catch (err) {
      next(err);
    }
  }

  /**
   * 字段 / 状态机配置平台 - 保存
   * PUT /api/v1/system/field-config
   */
  async updateFieldConfig(req, res, next) {
    try {
      res.success(await fieldConfigService.updateConfig(req.body));
    } catch (err) {
      next(err);
    }
  }

  /**
   * 回收站列表
   * GET /api/v1/system/recycle-bin
   */
  async getRecycleBin(req, res, next) {
    try {
      res.success(await systemService.getRecycleBin());
    } catch (err) {
      next(err);
    }
  }

  /**
   * 恢复回收站条目
   * POST /api/v1/system/recycle-bin/restore
   */
  async restoreRecycleBinItem(req, res, next) {
    try {
      const { model, id } = req.body || {};
      res.success(await systemService.restoreRecycleBinItem(model, id));
    } catch (err) {
      next(err);
    }
  }

  /**
   * 永久删除回收站条目
   * DELETE /api/v1/system/recycle-bin/:model/:id
   */
  async permanentlyDeleteRecycleBinItem(req, res, next) {
    try {
      res.success(await systemService.permanentlyDeleteRecycleBinItem(req.params.model, req.params.id));
    } catch (err) {
      next(err);
    }
  }

  /**
   * 清空回收站
   * DELETE /api/v1/system/recycle-bin/empty
   */
  async emptyRecycleBin(req, res, next) {
    try {
      res.success(await systemService.emptyRecycleBin());
    } catch (err) {
      next(err);
    }
  }

  /**
   * 首页三栏数据聚合
   * GET /api/v1/system/home-summary
   */
  async getHomeSummary(req, res, next) {
    try {
      res.success(await systemService.getHomeSummary());
    } catch (err) {
      next(err);
    }
  }

  /**
   * 首页推荐「一键生成沉淀草稿」
   * POST /api/v1/system/home-recommend
   */
  async autoRecommendVault(req, res, next) {
    try {
      res.success(await systemService.autoRecommendVault(req.body || {}));
    } catch (err) {
      next(err);
    }
  }

  /**
   * 图表聚合数据（V1.5 §8.1）
   * GET /api/v1/system/charts
   */
  async getCharts(req, res, next) {
    try {
      res.success(await systemService.getCharts());
    } catch (err) {
      next(err);
    }
  }

  /**
   * 项目详情图表（V1.5 §8.1）：里程碑时间线 + 任务速率
   * GET /api/v1/system/project-charts?projectId=xxx
   */
  async getProjectCharts(req, res, next) {
    try {
      res.success(await systemService.getProjectCharts(req.query.projectId));
    } catch (err) {
      next(err);
    }
  }
}

export default new SystemController();
