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

export const TODO_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
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
