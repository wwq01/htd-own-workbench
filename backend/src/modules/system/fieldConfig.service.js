import prisma from '../../database/prisma.js';
import {
  fieldConfigSchema,
  partialFieldConfigSchema,
} from './fieldConfig.schema.js';
import {
  PROJECT_PHASE,
  PROJECT_PHASE_TRANSITIONS,
  SECURITY_DOMAIN,
  READING_TYPE,
  READING_STATUS,
  READING_STATUS_TRANSITIONS,
  TODO_CATEGORY,
} from '../../common/constants/enums.js';

/**
 * §8.3 字段 / 状态机配置平台 - Service
 * 三类可配置项统一以 SystemSetting 的固定键持久化：
 *   config.dropdowns      { [scope]: string[] }            可增减的下拉项集
 *   config.customFields   { [scope]: CustomFieldDef[] }    模块扩展文本字段
 *   config.stateMachines  { [scope]: StateMachine }        可配置状态机迁移
 * 首次读取时以现有枚举为种子默认值，保证未配置时行为不变。
 */

const KEYS = {
  dropdowns: 'config.dropdowns',
  customFields: 'config.customFields',
  stateMachines: 'config.stateMachines',
};

function defaultConfig() {
  return {
    dropdowns: {
      'project.phase': Object.values(PROJECT_PHASE),
      'project.securityDomain': Object.values(SECURITY_DOMAIN),
      'reading.type': Object.values(READING_TYPE),
      'todo.category': Object.values(TODO_CATEGORY),
      tag: [],
    },
    customFields: {
      reading: [],
      project: [],
    },
    stateMachines: {
      'reading.status': {
        states: Object.values(READING_STATUS),
        transitions: READING_STATUS_TRANSITIONS,
        initial: READING_STATUS.UNREAD,
      },
      'project.phase': {
        states: Object.values(PROJECT_PHASE),
        transitions: PROJECT_PHASE_TRANSITIONS,
        initial: PROJECT_PHASE.REQUIREMENT,
      },
    },
  };
}

async function readKey(key) {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

async function writeKey(key, value) {
  const str = JSON.stringify(value ?? {});
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: str },
    update: { value: str },
  });
}

/**
 * 进程内同步缓存
 * zod 的 refine 只能同步执行，无法在校验中 await 数据库，
 * 故业务入口先 ensureFieldConfigCache() 把配置装载进缓存，
 * 校验期再通过 getXxxSync 同步读取；未装载时回落到默认枚举。
 */
const cache = {
  loaded: false,
  dropdowns: null,
  customFields: null,
  stateMachines: null,
};

// 正在进行的装载 Promise：并发调用复用同一次打库，避免重复查询
let loadingPromise = null;

/**
 * 装载同步缓存（幂等；并发共享同一个 Promise）
 * 缺失的键用 defaultConfig() 对应部分兜底。
 */
export async function ensureFieldConfigCache() {
  if (loadingPromise) return loadingPromise;
  if (cache.loaded) return cache;
  loadingPromise = (async () => {
    const [dropdowns, customFields, stateMachines] = await Promise.all([
      readKey(KEYS.dropdowns),
      readKey(KEYS.customFields),
      readKey(KEYS.stateMachines),
    ]);
    const def = defaultConfig();
    cache.dropdowns = dropdowns ?? def.dropdowns;
    cache.customFields = customFields ?? def.customFields;
    cache.stateMachines = stateMachines ?? def.stateMachines;
    cache.loaded = true;
    return cache;
  })();
  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

/**
 * 同步读取：下拉项集
 * 缓存未装载、或该 scope 未配置时，回落到默认枚举，绝不返回空集。
 */
export function getDropdownSync(scope) {
  const configured = cache.loaded && cache.dropdowns ? cache.dropdowns[scope] : undefined;
  if (Array.isArray(configured)) return configured;
  return defaultConfig().dropdowns[scope] ?? [];
}

/** 同步读取：模块自定义扩展字段定义 */
export function getCustomFieldsSync(scope) {
  const configured = cache.loaded && cache.customFields ? cache.customFields[scope] : undefined;
  if (Array.isArray(configured)) return configured;
  return defaultConfig().customFields[scope] ?? [];
}

/** 同步读取：可配置状态机 {states, transitions, initial}，未纳管域返回 null */
export function getStateMachineSync(scope) {
  const configured = cache.loaded && cache.stateMachines ? cache.stateMachines[scope] : undefined;
  if (configured && typeof configured === 'object') return configured;
  return defaultConfig().stateMachines[scope] ?? null;
}

/** 重置缓存（测试用：模拟「缓存未装载」场景） */
export function resetFieldConfigCache() {
  cache.loaded = false;
  cache.dropdowns = null;
  cache.customFields = null;
  cache.stateMachines = null;
  loadingPromise = null;
}

class FieldConfigService {
  async getConfig() {
    const [dropdowns, customFields, stateMachines] = await Promise.all([
      readKey(KEYS.dropdowns),
      readKey(KEYS.customFields),
      readKey(KEYS.stateMachines),
    ]);
    const def = defaultConfig();
    return {
      dropdowns: dropdowns ?? def.dropdowns,
      customFields: customFields ?? def.customFields,
      stateMachines: stateMachines ?? def.stateMachines,
    };
  }

  async updateConfig(payload = {}) {
    const parsed = partialFieldConfigSchema.parse(payload);
    const current = await this.getConfig();
    const next = {
      dropdowns: parsed.dropdowns !== undefined ? parsed.dropdowns : current.dropdowns,
      customFields: parsed.customFields !== undefined ? parsed.customFields : current.customFields,
      stateMachines:
        parsed.stateMachines !== undefined ? parsed.stateMachines : current.stateMachines,
    };
    // 全量校验（确保合并后结构合法）
    fieldConfigSchema.parse(next);
    await Promise.all([
      writeKey(KEYS.dropdowns, next.dropdowns),
      writeKey(KEYS.customFields, next.customFields),
      writeKey(KEYS.stateMachines, next.stateMachines),
    ]);
    // 写库后立即刷新同步缓存，使配置变更对后续校验即时生效
    cache.dropdowns = next.dropdowns;
    cache.customFields = next.customFields;
    cache.stateMachines = next.stateMachines;
    cache.loaded = true;
    return next;
  }

  async getDropdown(scope) {
    const cfg = await this.getConfig();
    return cfg.dropdowns[scope] ?? [];
  }

  async getCustomFields(scope) {
    const cfg = await this.getConfig();
    return cfg.customFields[scope] ?? [];
  }

  async getStateMachine(scope) {
    const cfg = await this.getConfig();
    return cfg.stateMachines[scope] ?? null;
  }
}

export default new FieldConfigService();
