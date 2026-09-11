import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mount } from '@vue/test-utils';
import HtpGraphCanvas from '../js/components/HtpGraphCanvas.vue';

/**
 * jsdom 无 canvas 实现，getContext 默认返回 null（组件会安全跳过绘制）。
 * 这里注入一个 no-op 2d context stub，让绘制路径真实跑起来，从而能测帧预算。
 */
let originGetContext = null;
beforeAll(() => {
  originGetContext = HTMLCanvasElement.prototype.getContext;
  const stub = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'measureText') return () => ({ width: 20 });
      if (prop === 'canvas') return {};
      return () => {};
    },
    set() { return true; },
  });
  HTMLCanvasElement.prototype.getContext = () => stub;
});
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originGetContext;
});

function makeGraph(n) {
  const nodes = [];
  const links = [];
  for (let i = 0; i < n; i += 1) {
    nodes.push({ id: `n${i}`, label: `节点${i}`, group: i % 8 });
  }
  for (let i = 1; i < n; i += 1) {
    links.push({ source: `n${i}`, target: `n${Math.floor(i / 2)}` });
  }
  return { nodes, links };
}

describe('HtpGraphCanvas（S2-2c）', () => {
  it('挂载后构建内部仿真节点与连线（不 mutate props）', () => {
    const nodes = [
      { id: 'a', label: '甲' },
      { id: 'b', label: '乙' },
      { id: 'c', label: '丙' },
    ];
    const links = [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }];
    const w = mount(HtpGraphCanvas, { props: { nodes, links, running: false } });
    expect(w.vm.simNodes.length).toBe(3);
    expect(w.vm.simLinks.length).toBe(2);
    // props 未被 d3-force 写入 x/y
    expect(nodes[0].x).toBeUndefined();
    w.unmount();
  });

  it('过滤端点不存在的脏连线，不抛错', () => {
    const nodes = [{ id: 'a', label: '甲' }, { id: 'b', label: '乙' }];
    const links = [{ source: 'a', target: 'b' }, { source: 'a', target: 'ghost' }];
    const w = mount(HtpGraphCanvas, { props: { nodes, links, running: false } });
    expect(w.vm.simLinks.length).toBe(1);
    expect(() => w.vm.tick()).not.toThrow();
    w.unmount();
  });

  it('hitTest 命中节点并派发 node-click', async () => {
    const nodes = [{ id: 'a', label: '甲' }, { id: 'b', label: '乙' }];
    const w = mount(HtpGraphCanvas, { props: { nodes, links: [], running: false } });
    w.vm.simNodes[0].x = 100;
    w.vm.simNodes[0].y = 100;
    w.vm.simNodes[1].x = 400;
    w.vm.simNodes[1].y = 300;
    expect(w.vm.hitTest(100, 100).id).toBe('a');
    expect(w.vm.hitTest(250, 250)).toBeNull();
    await w.find('canvas').trigger('click', { clientX: 100, clientY: 100 });
    expect(w.emitted('node-click')).toBeTruthy();
    expect(w.emitted('node-click')[0][0].id).toBe('a');
    w.unmount();
  });

  it('空节点显示空态', () => {
    const w = mount(HtpGraphCanvas, { props: { nodes: [], links: [], running: false } });
    expect(w.find('.htp-graph__empty').exists()).toBe(true);
    w.unmount();
  });

  it('1k 节点性能门槛：单帧（tick+draw）平均 < 33.3ms（≥30fps）', () => {
    const { nodes, links } = makeGraph(1000);
    const w = mount(HtpGraphCanvas, { props: { nodes, links, running: false } });
    expect(w.vm.simNodes.length).toBe(1000);
    // 预热 5 帧（JIT + Barnes-Hut 树构建）
    for (let i = 0; i < 5; i += 1) w.vm.tick();
    const N = 30;
    const t0 = performance.now();
    for (let i = 0; i < N; i += 1) w.vm.tick();
    const avg = (performance.now() - t0) / N;
    // eslint-disable-next-line no-console
    console.log(`[graph perf] 1000 nodes / 999 links → ${avg.toFixed(2)} ms per frame`);
    expect(avg).toBeLessThan(33.3);
    w.unmount();
  });
});
