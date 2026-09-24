import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

/**
 * 加载无构建全局脚本（与 backend/scripts/verify-registry.js 同手法：模拟 window 后 eval）
 */
function loadGlobalScript(rel) {
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

let hc;
let reg;

beforeAll(() => {
  if (typeof global.window === 'undefined') global.window = {};
  loadGlobalScript('js/registry.js');
  loadGlobalScript('js/home-cards.js');
  reg = global.window.htdRegistry;
  hc = global.window.htdHomeCards;
});

describe('home-cards 声明表', () => {
  it('挂载到 window.htdHomeCards', () => {
    expect(hc).toBeTruthy();
    expect(Array.isArray(hc.HOME_COLUMNS)).toBe(true);
  });

  it('三栏定义为 work/life/knowledge', () => {
    expect(hc.HOME_COLUMNS.map((c) => c.key)).toEqual(['work', 'life', 'knowledge']);
  });

  it('卡片 module 均存在于 MODULE_META（杜绝手写路径漂移）', () => {
    const metaKeys = reg.MODULE_META.map((m) => m.key);
    const all = hc.HOME_CARDS.concat(hc.HOME_FEATURE_CARDS);
    const bad = all.filter((c) => c.module != null && !metaKeys.includes(c.module));
    expect(bad).toEqual([]);
  });

  it('卡片 key 无重复', () => {
    const keys = hc.HOME_CARDS.map((c) => c.key).concat(hc.HOME_FEATURE_CARDS.map((c) => c.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('source 均在后端契约白名单内', () => {
    const bad = hc.HOME_CARDS.filter((c) => !hc.HOME_DATA_PATHS.includes(c.source));
    expect(bad).toEqual([]);
  });
});

describe('getByPath / renderTpl 工具', () => {
  it('getByPath 正常取深层值', () => {
    expect(hc.getByPath({ a: { b: { c: 1 } } }, 'a.b.c')).toBe(1);
  });
  it('getByPath 路径缺失返回 undefined 不抛错', () => {
    expect(hc.getByPath({ a: {} }, 'a.b.c')).toBeUndefined();
    expect(hc.getByPath(null, 'a.b')).toBeUndefined();
    expect(hc.getByPath({}, '')).toBeUndefined();
  });
  it('renderTpl 插值，缺失字段回落空串', () => {
    expect(hc.renderTpl('草稿 {draft} · 已沉淀 {precipitated}', { draft: 1, precipitated: 2 }))
      .toBe('草稿 1 · 已沉淀 2');
    expect(hc.renderTpl('草稿 {draft}', {})).toBe('草稿 ');
    expect(hc.renderTpl(null, {})).toBe('');
  });
});

describe('resolveModulePath / buildHomeCards', () => {
  it('resolveModulePath 解析已注册模块', () => {
    expect(hc.resolveModulePath('todo')).toBe('/todo');
    expect(hc.resolveModulePath('time-block')).toBe('/time-block');
  });
  it('resolveModulePath 未知 key 返回 null（不静默拼路径）', () => {
    expect(hc.resolveModulePath('not-exist')).toBeNull();
    expect(hc.resolveModulePath(null)).toBeNull();
  });

  it('buildHomeCards 产出 3 栏且卡片数与声明一致', () => {
    const built = hc.buildHomeCards({});
    expect(built.length).toBe(3);
    const total = built.reduce((s, c) => s + c.cards.length, 0);
    expect(total).toBe(hc.HOME_CARDS.length);
  });

  it('空数据时 items 为空数组、不抛错（模板不会渲染出 undefined）', () => {
    const built = hc.buildHomeCards({});
    built.forEach((col) => {
      col.cards.forEach((c) => {
        expect(Array.isArray(c.items)).toBe(true);
        expect(c.items.length).toBe(0);
      });
    });
  });

  it('有数据时正确绑定 data 与 items', () => {
    const home = {
      work: { todayProgress: { percent: 40, completed: 2, total: 5 }, activeProjects: [{ id: 'p1', name: 'A', phase: '实施', progress: 30, phaseColor: '#fff' }] },
      life: { maxStreak: 7, todayTomatoes: { completed: 3, target: 8 } },
      knowledge: { vaultWeek: { total: 4, draft: 1, precipitated: 3 } },
    };
    const built = hc.buildHomeCards(home);
    const work = built[0];
    const progressCard = work.cards.find((c) => c.key === 'todo-progress');
    expect(progressCard.data.percent).toBe(40);
    expect(progressCard.path).toBe('/todo');

    const projectCard = work.cards.find((c) => c.key === 'project-active');
    expect(projectCard.items.length).toBe(1);
    expect(projectCard.path).toBe('/project');

    const knowledge = built[2];
    const vaultCard = knowledge.cards.find((c) => c.key === 'vault-week');
    expect(vaultCard.data.total).toBe(4);
    expect(hc.renderTpl(vaultCard.hintTpl, vaultCard.data)).toBe('草稿 1 · 已沉淀 3');
  });

  it('buildFeatureCards 解析出真实 path', () => {
    const fs2 = hc.buildFeatureCards();
    expect(fs2.length).toBeGreaterThan(0);
    fs2.forEach((f) => expect(f.path).toBeTruthy());
  });

  it('itemSub 格式化：项目「阶段 · 进度」与习惯「本周/今日 X / Y」', () => {
    const proj = hc.HOME_CARDS.find((c) => c.key === 'project-active');
    expect(proj.itemSub({ phase: '实施', progress: 30 })).toBe('实施 · 进度 30%');
    const habit = hc.HOME_CARDS.find((c) => c.key === 'habit-today');
    expect(habit.itemSub({ kind: 'weekly', current: 2, target: 5 })).toBe('本周 2 / 5');
    expect(habit.itemSub({ kind: 'daily', current: 1, target: 3 })).toBe('今日 1 / 3');
  });

  it('会议纪要 itemSub 走 htdDate.formatDate（未挂载时不抛错）', () => {
    const meeting = hc.HOME_CARDS.find((c) => c.key === 'meeting-recent');
    expect(typeof meeting.itemSub).toBe('function');
    expect(() => meeting.itemSub({ heldAt: new Date() })).not.toThrow();
  });
});

describe('HomePage 渲染结构防丢（meta 化不得破坏视觉契约）', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/modules/HomePage.js'), 'utf8');

  it('保留三栏与卡片全部关键 class', () => {
    [
      'home-page', 'home-three-col', 'home-col', 'home-col__head', 'home-col__icon', 'home-col__title',
      'home-card', 'home-card__title', 'home-card__value', 'home-card__hint', 'home-card__body',
      'home-card__row', 'home-card__row-main', 'home-card__row-title', 'home-card__row-sub',
      'home-card__empty', 'home-card__viewall', 'home-phase-dot',
      'home-progress', 'home-progress__bar', 'home-progress__meta', 'home-progress__percent',
    ].forEach((cls) => {
      expect(src.includes(cls)).toBe(true);
    });
  });

  it('不再硬编码卡片数据与手写路由（一律 meta 驱动）', () => {
    expect(src).not.toContain('home.work.');
    expect(src).not.toContain('home.life.');
    expect(src).not.toContain('home.knowledge.');
    expect(src).not.toContain('function goTodo');
    expect(src).not.toContain('function goProject');
  });

  it('图表区块保留（未纳入 meta 化的既有能力不回退）', () => {
    ['HtpBarChart', 'HtpDonutChart', 'HtpChartLegend', 'home-charts'].forEach((t) => {
      expect(src.includes(t)).toBe(true);
    });
  });
});
