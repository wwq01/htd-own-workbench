/**
 * 项目模块 - Service 服务层
 */
import projectRepository from './project.repository.js';
import prisma from '../../database/prisma.js';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectSchema,
  projectIdSchema,
} from './project.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { REVIEW_TYPE, PROJECT_PHASE_TRANSITIONS } from '../../common/constants/enums.js';
import { createStateMachine } from '../../lib/stateMachine.js';
import { parseFieldsParam, pickFields } from '../../lib/fieldSelector.js';
import {
  ensureFieldConfigCache,
  getStateMachineSync,
} from '../system/fieldConfig.service.js';

class ProjectService {
  /**
   * 新增项目
   */
  async create(payload) {
    // 先装载 §8.3 配置缓存，保证 schema 里配置驱动的下拉校验读到最新值
    await ensureFieldConfigCache();
    const data = createProjectSchema.parse(payload);

    // securityDomains 转 JSON 字符串存储
    const securityDomainsStr = JSON.stringify(data.securityDomains || []);

    const created = await projectRepository.create({
      customerName: data.customerName,
      phase: data.phase,
      securityDomains: securityDomainsStr,
      priority: data.priority,
      background: this._normalizeText(data.background),
      coreRequirements: this._normalizeText(data.coreRequirements),
      solutionVersion: this._normalizeText(data.solutionVersion),
      contactInfo: this._normalizeText(data.contactInfo),
      projectMemo: this._normalizeText(data.projectMemo),
      startDate: this._normalizeText(data.startDate),
      expectedEndDate: this._normalizeText(data.expectedEndDate),
      progress: 0,
      sortOrder: data.sortOrder ?? 0,
    });
    return this._normalizeProject(created);
  }

  /**
   * 编辑项目（部分字段更新）
   */
  async update(payload) {
    await ensureFieldConfigCache();
    const parsed = updateProjectSchema.parse(payload);
    const { id, ...fields } = parsed;
    const exists = await projectRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '项目不存在');
    }

    const updateData = {};
    if ('customerName' in fields) updateData.customerName = fields.customerName;
    // phase 变更走受控 changePhase（校验 + 写阶段历程），不在 update 直接改
    const phaseChanged = 'phase' in fields && fields.phase && fields.phase !== exists.phase;
    if ('priority' in fields) updateData.priority = fields.priority;
    if ('securityDomains' in fields) {
      updateData.securityDomains = JSON.stringify(fields.securityDomains || []);
    }
    if ('background' in fields) updateData.background = this._normalizeText(fields.background);
    if ('coreRequirements' in fields) updateData.coreRequirements = this._normalizeText(fields.coreRequirements);
    if ('solutionVersion' in fields) updateData.solutionVersion = this._normalizeText(fields.solutionVersion);
    if ('contactInfo' in fields) updateData.contactInfo = this._normalizeText(fields.contactInfo);
    if ('projectMemo' in fields) updateData.projectMemo = this._normalizeText(fields.projectMemo);
    if ('startDate' in fields) updateData.startDate = this._normalizeText(fields.startDate);
    if ('expectedEndDate' in fields) updateData.expectedEndDate = this._normalizeText(fields.expectedEndDate);
    if ('sortOrder' in fields) updateData.sortOrder = fields.sortOrder;

    let updated = await projectRepository.updateById(id, updateData);
    if (phaseChanged) {
      updated = await this.changePhase(id, fields.phase, fields.phaseReason);
    }
    return this._normalizeProject(updated);
  }

  /**
   * 项目阶段切换（受 6 阶段状态机约束，§6.2.2）
   * 每次切换必写一条 ProjectPhaseTransition 记录；非法迁移抛 BusinessError。
   * 交付跟进 → 项目结项 时自动生成项目复盘草稿（§6.3.4）。
   */
  async changePhase(id, toPhase, reason) {
    projectIdSchema.parse({ id });
    const exists = await projectRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '项目不存在');
    }
    const fromPhase = exists.phase;
    if (fromPhase === toPhase) {
      return this._normalizeProject(exists);
    }
    // 迁移表取自配置平台（§8.3），未配置时回落默认常量
    await ensureFieldConfigCache();
    const smConfig = getStateMachineSync('project.phase');
    const transitions = smConfig?.transitions || PROJECT_PHASE_TRANSITIONS;
    const allowed = transitions[fromPhase] || [];
    if (!allowed.includes(toPhase)) {
      throw new BusinessError(
        ErrorCodes.PARAM_ERROR,
        `非法的项目阶段迁移「${fromPhase} → ${toPhase}」`,
      );
    }
    const updated = await projectRepository.updateById(id, { phase: toPhase });
    await prisma.projectPhaseTransition.create({
      data: { projectId: id, fromPhase, toPhase, reason: reason || null },
    });
    // 结项钩子：交付跟进 → 项目结项 自动生成项目复盘草稿
    if (fromPhase === '交付跟进' && toPhase === '项目结项') {
      try {
        await this.generateReview(id);
      } catch (e) {
        // 已存在复盘草稿则忽略
      }
    }
    return this._normalizeProject(updated);
  }

  /**
   * 软删除项目（级联软删除里程碑与任务由 Prisma onDelete: Cascade 处理硬删，
   * 此处为安全软删，仅标记项目；前端按 deletedAt 过滤）
   */
  async delete(id) {
    projectIdSchema.parse({ id });
    const exists = await projectRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '项目不存在');
    }
    // 同时软删关联的里程碑与任务
    await prisma.projectMilestone.updateMany({
      where: { projectId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await prisma.projectTask.updateMany({
      where: { projectId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return projectRepository.softDeleteById(id);
  }

  /**
   * 根据 ID 获取项目详情（含里程碑 + 任务）
   */
  async getDetailById(id) {
    projectIdSchema.parse({ id });
    const project = await projectRepository.findDetailById(id);
    if (!project) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '项目不存在');
    }
    // 解析 securityDomains 字符串 → 数组
    return this._normalizeProject(project);
  }

  /**
   * 列表查询（带筛选）
   */
  async list(query = {}) {
    await ensureFieldConfigCache();
    const q = listProjectSchema.parse(query);
    const list = await projectRepository.listWithFilters({
      phase: q.phase,
      priority: q.priority,
      securityDomain: q.securityDomain,
      keyword: q.keyword,
    });
    const normalized = list.map(p => this._normalizeProject(p));
    const fields = parseFieldsParam(q.fields);
    return fields ? pickFields(normalized, fields) : normalized;
  }

  /**
   * 更新项目备忘（失焦自动保存场景，仅更新 projectMemo 字段）
   */
  async updateMemo(id, projectMemo) {
    projectIdSchema.parse({ id });
    const exists = await projectRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '项目不存在');
    }
    return projectRepository.updateById(id, {
      projectMemo: this._normalizeText(projectMemo),
    });
  }

  /**
   * 自动重算项目整体进度
   * 规则：基于一级任务完成数 / 总任务数 * 100
   *       无任务时按里程碑完成比例
   *       都无任务则保持 progress 字段不动
   */
  async recalcProgress(projectId) {
    const project = await projectRepository.findDetailById(projectId);
    if (!project) return null;

    let progress = 0;
    const tasks = project.tasks || [];
    const milestones = project.milestones || [];

    if (tasks.length > 0) {
      const completedCount = tasks.filter(t => t.completed).length;
      progress = Math.round((completedCount / tasks.length) * 100);
    } else if (milestones.length > 0) {
      const completedCount = milestones.filter(m => m.completed).length;
      progress = Math.round((completedCount / milestones.length) * 100);
    } else {
      // 无任务、无里程碑：保留原进度
      return project;
    }

    return projectRepository.updateById(projectId, { progress });
  }

  /**
   * 一键生成项目复盘：创建复盘草稿并预填项目基础信息
   */
  async generateReview(projectId) {
    projectIdSchema.parse({ id: projectId });
    const project = await projectRepository.findDetailById(projectId);
    if (!project) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '项目不存在');
    }

    // 检查是否已有该项目的复盘草稿（避免重复生成）
    const existed = await prisma.review.findFirst({
      where: {
        deletedAt: null,
        type: REVIEW_TYPE.PROJECT,
        projectId,
      },
    });
    if (existed) {
      // 已存在则直接返回，前端可跳转到复盘模块编辑
      return { review: existed, project: this._normalizeProject(project), created: false };
    }

    // 自动填充数据：里程碑总数/已完成/任务总数/已完成/进度
    const tasks = project.tasks || [];
    const milestones = project.milestones || [];
    const autoData = JSON.stringify({
      projectPhase: project.phase,
      priority: project.priority,
      progress: project.progress,
      milestoneTotal: milestones.length,
      milestoneCompleted: milestones.filter(m => m.completed).length,
      taskTotal: tasks.length,
      taskCompleted: tasks.filter(t => t.completed).length,
      startDate: project.startDate,
      expectedEndDate: project.expectedEndDate,
    });

    const review = await prisma.review.create({
      data: {
        type: REVIEW_TYPE.PROJECT,
        projectId: project.id,
        autoData,
        vaultSourceType: 'PROJECT_REVIEW',
        // 项目复盘模板字段（先留空，由用户填写）
        customerPainPoints: null,
        presentationHighlights: null,
        exposedWeakness: null,
        reusableTips: null,
        reviewResult: null,
        remark: `基于项目「${project.customerName}」自动生成的复盘草稿`,
      },
    });

    return { review, project: this._normalizeProject(project), created: true };
  }

  /**
   * 文本字段规范化：空字符串 → null
   */
  _normalizeText(value) {
    if (value === '' || value === undefined || value === null) return null;
    return value;
  }

  /**
   * 项目对象规范化：securityDomains 字符串 → 数组
   */
  _normalizeProject(project) {
    if (!project) return project;
    let domains = [];
    try {
      domains = JSON.parse(project.securityDomains || '[]');
      if (!Array.isArray(domains)) domains = [];
    } catch (e) {
      domains = [];
    }
    return { ...project, securityDomains: domains };
  }
}

export default new ProjectService();
