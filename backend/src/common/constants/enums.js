/**
 * 全局业务枚举常量
 * 对齐 PRD 中各模块的下拉选项定义
 */

// ===== 待办事项 =====
export const TODO_CATEGORY = {
  PRESALE: '售前工作',
  DAILY: '日常事务',
  LIFE: '生活事项',
};

export const TODO_PRIORITY = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

// ===== 项目管理 =====
export const PROJECT_PHASE = {
  REQUIREMENT: '需求沟通',
  PROPOSAL: '方案撰写',
  POC: 'POC演示',
  BIDDING: '投标答辩',
  DELIVERY: '交付跟进',
  CLOSED: '项目结项',
};

// 项目阶段标签色
export const PROJECT_PHASE_COLORS = {
  '需求沟通': '#64748B',
  '方案撰写': '#3B82F6',
  'POC演示': '#8B5CF6',
  '投标答辩': '#F97316',
  '交付跟进': '#06B6D4',
  '项目结项': '#10B981',
};

export const SECURITY_DOMAIN = {
  BOUNDARY: '传统边界安全',
  DATA: '数据安全',
  COMPLIANCE: '等保合规',
  AI: 'AI安全',
  LLM: '大模型安全',
  AGENT: '智能体安全',
  ZERO_TRUST: '零信任',
  OTHER: '其他',
};

export const PROJECT_PRIORITY = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

// ===== 开发工作 =====
export const DEV_PROJECT_STATUS = {
  DEVELOPING: '开发中',
  COMPLETED: '已完成',
  PAUSED: '搁置',
};

export const DEV_ISSUE_STATUS = {
  PENDING: '待解决',
  INVESTIGATING: '排查中',
  RESOLVED: '已解决',
};

// ===== 游戏娱乐 =====
export const ENTERTAINMENT_TYPE = {
  GAME: '游戏',
  ANIME: '番剧',
  DRAMA: '剧集',
  BOOK: '书籍',
  OTHER: '其他',
};

export const ENTERTAINMENT_STATUS = {
  WANT: '想看',
  PLAYING: '在玩',
  COMPLETED: '已通关',
  DROPPED: '弃坑',
};

// ===== 充电学习 =====
export const STUDY_TYPE = {
  PROFESSIONAL: '专业学习',
  GENERAL: '通用学习',
};

// ===== 复盘 =====
export const REVIEW_TYPE = {
  WEEK: 'week',
  PROJECT: 'project',
};

export const REVIEW_RESULT = {
  WON: '成单',
  LOST: '丢单',
  PAUSED: '暂停',
  FOLLOWING: '持续跟进',
};

// ===== 凭据保险箱 =====
export const SECRET_TYPE = {
  ENV_ACCOUNT: '环境账号',
  PLATFORM_ACCOUNT: '平台账号',
  API_KEY: 'API密钥',
  LICENSE: '授权码',
  OTHER: '其他',
};

// ===== 部署记录 =====
export const DEPLOY_ENV_TYPE = {
  DEMO: '演示环境',
  TEST: '测试环境',
  PRODUCTION: '生产环境',
  LOCAL: '本地环境',
};

// ===== 里程碑到期提醒阈值（天）=====
export const MILESTONE_WARNING_DAYS = 7;

// ============================================================
// V1.3 新模块枚举
// ============================================================

// ===== 待办 5 态（兼容旧数据：NOT_STARTED 复用 pending 字符串值）=====
export const TODO_STATUS = {
  NOT_STARTED: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DELAYED: 'delayed',
};

// ===== 复盘 3 态 =====
export const REVIEW_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  PRECIPITATED: 'precipitated',
};

// 复盘 3 态合法迁移（draft → submitted → precipitated）
export const REVIEW_STATUS_TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['precipitated'],
  precipitated: [],
};

// ===== 任务 5 态合法迁移（兼容旧数据 pending = NOT_STARTED）=====
export const TODO_STATUS_TRANSITIONS = {
  pending: ['in_progress', 'delayed', 'cancelled', 'completed'],
  in_progress: ['completed', 'delayed', 'cancelled', 'pending'],
  delayed: ['in_progress', 'cancelled', 'completed'],
  completed: ['pending'],
  cancelled: ['pending'],
};

// ===== 习惯打卡频率 =====
export const HABIT_FREQUENCY = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
};

// ===== 时间块类型 =====
export const TIME_BLOCK_TYPE = {
  WORK: 'WORK',
  STUDY: 'STUDY',
  REST: 'REST',
  OTHER: 'OTHER',
};

// ===== 财务收支类型 =====
export const FINANCE_TYPE = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
};

// ===== 财务分类 =====
export const FINANCE_CATEGORY = {
  FOOD: 'FOOD',
  HOUSING: 'HOUSING',
  TRANSPORT: 'TRANSPORT',
  SALARY: 'SALARY',
  REIMBURSEMENT: 'REIMBURSEMENT',
  OTHER: 'OTHER',
};

// ===== 沉淀状态 =====
export const VAULT_STATUS = {
  DRAFT: 'DRAFT',
  PRECIPITATED: 'PRECIPITATED',
  ARCHIVED: 'ARCHIVED',
};

// ===== 沉淀来源类型 =====
export const VAULT_SOURCE_TYPE = {
  MANUAL: 'MANUAL',
  WEEKLY_REVIEW: 'WEEKLY_REVIEW',
  PROJECT_REVIEW: 'PROJECT_REVIEW',
  MEETING_REVIEW: 'MEETING_REVIEW',
  CREDENTIAL_NOTE: 'CREDENTIAL_NOTE',
  DEPLOY_NOTE: 'DEPLOY_NOTE',
  READING_NOTE: 'READING_NOTE',
};

// ===== S2-4 双轨笔记：笔记挂载来源（通用软关联 sourceType + sourceId）=====
export const NOTE_SOURCE_TYPE = {
  READING: 'READING', // 阅读资料（原文 ↔ 笔记 双轨）
  MEETING: 'MEETING', // 会议纪要
  VAULT: 'VAULT', // 沉淀条目
  MANUAL: 'MANUAL', // 独立笔记
};

// ===== 项目阶段合法迁移（6 阶段，中文值对齐现有 PROJECT_PHASE）=====
export const PROJECT_PHASE_TRANSITIONS = {
  '需求沟通': ['方案撰写', 'POC演示', '项目结项', '需求沟通'],
  '方案撰写': ['POC演示', '投标答辩', '项目结项', '方案撰写'],
  'POC演示': ['投标答辩', '交付跟进', '项目结项', 'POC演示'],
  '投标答辩': ['交付跟进', '项目结项', '投标答辩'],
  '交付跟进': ['项目结项', '交付跟进'],
  '项目结项': ['需求沟通'], // 结项后可重开
};

// ============================================================
// V1.4 四大新模块枚举（对齐 blueprint §4.4）
// ============================================================

// ===== POC 跟踪 6 态 =====
export const POC_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

// POC 6 态合法迁移
export const POC_STATUS_TRANSITIONS = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['success', 'failed', 'cancelled'],
  success: [],
  failed: [],
  cancelled: [],
};

// ===== 投标档案 3 态 =====
export const BID_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  ARCHIVED: 'archived',
};

// 投标 3 态合法迁移
export const BID_STATUS_TRANSITIONS = {
  draft: ['submitted', 'archived'],
  submitted: ['archived'],
  archived: [],
};

// 投标结果
export const BID_RESULT = {
  PENDING: 'pending',
  WON: 'won',
  LOST: 'lost',
};

// ===== RFP 条目应答类型（S2-5 逐条应答）=====
// 对齐投标实务：完全响应 / 部分响应 / 优于要求 / 偏离 / 不响应；pending 为占位
export const RFP_RESPONSE_TYPE = {
  PENDING: 'pending',
  FULL: 'full',
  PARTIAL: 'partial',
  EXCEED: 'exceed',
  DEVIATION: 'deviation',
  NON: 'non',
};

// ===== RFP 条目应答进度 3 态（S2-5）=====
export const RFP_ITEM_STATUS = {
  TODO: 'todo',
  DOING: 'doing',
  DONE: 'done',
};

// RFP 条目 3 态合法迁移
export const RFP_ITEM_STATUS_TRANSITIONS = {
  todo: ['doing', 'done'],
  doing: ['done', 'todo'],
  done: ['doing'],
};

// 证据挂载来源类型（通用软关联，与 S2-4 Note 的 sourceType 同源设计，无外键）
export const EVIDENCE_SOURCE_TYPE = {
  VAULT: 'VAULT',
  POC: 'POC',
  VULN: 'VULN',
  MEETING: 'MEETING',
  NOTE: 'NOTE',
  CONTRACT: 'CONTRACT',
  DEPLOYMENT: 'DEPLOYMENT',
  OTHER: 'OTHER',
};

// ===== 漏洞修复 5 态 =====
export const VULN_FIX_STATUS = {
  OPEN: 'open',
  FIXING: 'fixing',
  FIXED: 'fixed',
  WONT_FIX: 'wont_fix',
  CLOSED: 'closed',
};

// 漏洞修复 5 态合法迁移
export const VULN_FIX_STATUS_TRANSITIONS = {
  open: ['fixing', 'wont_fix', 'closed'],
  fixing: ['fixed', 'wont_fix', 'closed'],
  fixed: ['closed'],
  wont_fix: ['closed'],
  closed: [],
};

// ===== 严重度（漏洞 + 应急 共用）=====
export const SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// ===== 应急响应 4 态 =====
export const EMERGENCY_STATUS = {
  OPEN: 'open',
  CONTAINED: 'contained',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};

// 应急 4 态合法迁移
export const EMERGENCY_STATUS_TRANSITIONS = {
  open: ['contained', 'resolved', 'closed'],
  contained: ['resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
};

// ============================================================
// V1.5 阅读 / 资料模块枚举
// ============================================================

// ===== 阅读资料类型 =====
export const READING_TYPE = {
  ARTICLE: '文章',
  WECHAT: '公众号',
  CVE: 'CVE',
  PAPER: '论文',
};

// ===== 阅读状态 4 态 =====
export const READING_STATUS = {
  UNREAD: 'unread',
  READING: 'reading',
  PRECIPITATED: 'precipitated',
  ARCHIVED: 'archived',
};

// 阅读 4 态合法迁移（状态机约束，非法迁移抛 PARAM_ERROR）
export const READING_STATUS_TRANSITIONS = {
  unread: ['reading', 'archived'],
  reading: ['precipitated', 'archived', 'unread'],
  precipitated: ['archived', 'reading'],
  archived: ['unread'],
};

// ===== 自定义扩展字段类型（系统设置可配置，V1.5）=====
export const CUSTOM_FIELD_TYPE = {
  SINGLE_LINE: 'single_line',
  MULTI_LINE: 'multi_line',
};
