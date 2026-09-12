/**
 * 漏洞跟踪库模块 - Service 服务层
 */
import vulnRepository from './vuln.repository.js';
import {
  createVulnSchema,
  updateVulnSchema,
  listVulnSchema,
  vulnIdSchema,
  changeVulnStatusSchema,
  assetGroupsSchema,
} from './vuln.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { VULN_FIX_STATUS, VULN_FIX_STATUS_TRANSITIONS, SEVERITY } from '../../common/constants/enums.js';
import { createStateMachine } from '../../lib/stateMachine.js';
import { resolveStateMachine } from '../system/fieldConfig.service.js';
import prisma from '../../database/prisma.js';

/** S1-5：资产分组持久化键（原存 localStorage，清缓存即丢，违反数据自主） */
const VULN_ASSET_GROUPS_KEY = 'vuln.assetGroups';

class VulnService {
  /**
   * 新增漏洞
   */
  async create(payload) {
    const data = createVulnSchema.parse(payload);
    const created = await vulnRepository.create({
      assetGroup: data.assetGroup,
      vulnId: data.vulnId,
      affectedProduct: this._nullify(data.affectedProduct),
      exploitMethod: this._nullify(data.exploitMethod),
      reproduction: this._nullify(data.reproduction),
      fixStatus: data.fixStatus || VULN_FIX_STATUS.OPEN,
      severity: data.severity || SEVERITY.MEDIUM,
      sortOrder: data.sortOrder ?? 0,
    });
    return this.toPublic(created);
  }

  /**
   * 编辑漏洞（部分字段更新；修复状态变更走 changeStatus）
   */
  async update(payload) {
    const parsed = updateVulnSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await vulnRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '漏洞不存在');
    }
    const updateData = {};
    if ('assetGroup' in fields) updateData.assetGroup = fields.assetGroup;
    if ('vulnId' in fields) updateData.vulnId = fields.vulnId;
    if ('affectedProduct' in fields) updateData.affectedProduct = this._nullify(fields.affectedProduct);
    if ('exploitMethod' in fields) updateData.exploitMethod = this._nullify(fields.exploitMethod);
    if ('reproduction' in fields) updateData.reproduction = this._nullify(fields.reproduction);
    if ('severity' in fields) updateData.severity = fields.severity;
    if ('sortOrder' in fields) updateData.sortOrder = fields.sortOrder;
    const updated = await vulnRepository.updateById(id, updateData);
    return this.toPublic(updated);
  }

  /**
   * 软删除漏洞
   */
  async delete(id) {
    vulnIdSchema.parse({ id });
    const exists = await vulnRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '漏洞不存在');
    }
    await vulnRepository.softDeleteById(id);
    return null;
  }

  /**
   * 根据 ID 获取详情
   */
  async getById(id) {
    vulnIdSchema.parse({ id });
    const r = await vulnRepository.findById(id);
    if (!r) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '漏洞不存在');
    }
    return this.toPublic(r);
  }

  /**
   * 列表查询（资产组为隔离维度，缺失 assetGroup 时返回空列表）
   */
  async list(query = {}) {
    const q = listVulnSchema.parse(query);
    if (!q.assetGroup) {
      return [];
    }
    const result = await vulnRepository.list({
      assetGroup: q.assetGroup,
      q: q.q,
      fixStatus: q.fixStatus,
      severity: q.severity,
      page: q.page,
      limit: q.limit,
      sort: q.sort,
      order: q.order,
    });
    if (Array.isArray(result)) return result.map((r) => this.toPublic(r));
    return { ...result, list: result.list.map((r) => this.toPublic(r)) };
  }

  /**
   * 修复状态切换（受漏洞 5 态状态机约束，非法迁移抛 PARAM_ERROR）
   */
  async changeStatus(id, toStatus) {
    vulnIdSchema.parse({ id });
    if (!Object.values(VULN_FIX_STATUS).includes(toStatus)) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, `非法的修复状态「${toStatus}」`);
    }
    const exists = await vulnRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '漏洞不存在');
    }
    // S1-3：迁移表取自配置平台，未配置/配置非法时回落默认常量
    const { transitions } = await resolveStateMachine('vuln.fixStatus', {
      states: Object.values(VULN_FIX_STATUS),
      transitions: VULN_FIX_STATUS_TRANSITIONS,
    });
    const sm = createStateMachine({ name: 'VulnFixStatus', ALLOWED_TRANSITIONS: transitions });
    await sm.transition(exists.fixStatus, toStatus);
    const updated = await vulnRepository.updateById(id, { fixStatus: toStatus });
    return this.toPublic(updated);
  }

  _nullify(v) {
    if (v === '' || v === undefined || v === null) return null;
    return v;
  }

  /**
   * 白名单序列化：仅暴露业务字段，绝不外泄 deletedAt
   */
  toPublic(r) {
    if (!r) return r;
    return {
      id: r.id,
      assetGroup: r.assetGroup,
      vulnId: r.vulnId,
      affectedProduct: r.affectedProduct,
      exploitMethod: r.exploitMethod,
      reproduction: r.reproduction,
      fixStatus: r.fixStatus,
      severity: r.severity,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  /**
   * S1-5：读取资产分组（持久化于 SystemSetting，替代 localStorage）
   * 未配置或数据损坏时返回空数组，不抛错（前端可降级）
   */
  async getAssetGroups() {
    const row = await prisma.systemSetting.findUnique({ where: { key: VULN_ASSET_GROUPS_KEY } });
    if (!row) return [];
    try {
      const parsed = JSON.parse(row.value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * S1-5：保存资产分组（去空 + 去重 + 上限校验）
   */
  async saveAssetGroups(payload) {
    const parsed = assetGroupsSchema.parse(payload);
    const unique = [...new Set(parsed.map((g) => String(g).trim()).filter(Boolean))];
    await prisma.systemSetting.upsert({
      where: { key: VULN_ASSET_GROUPS_KEY },
      create: { key: VULN_ASSET_GROUPS_KEY, value: JSON.stringify(unique) },
      update: { value: JSON.stringify(unique) },
    });
    return unique;
  }
}

export default new VulnService();
