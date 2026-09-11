import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HtpBarChart from '../js/components/HtpBarChart.vue';
import HtpDonutChart from '../js/components/HtpDonutChart.vue';
import HtpLineChart from '../js/components/HtpLineChart.vue';
import HtpStackedBarChart from '../js/components/HtpStackedBarChart.vue';
import HtpTimelineChart from '../js/components/HtpTimelineChart.vue';
import HtpChartLegend from '../js/components/HtpChartLegend.vue';

const bars = [
  { label: '一月', value: 10 },
  { label: '二月', value: 20 },
  { label: '三月', value: 30 },
];

describe('HtpBarChart（S2-2a 根治 P0-3）', () => {
  it('用 v-for 渲染 SVG 节点而非 v-html', () => {
    const w = mount(HtpBarChart, { props: { data: bars } });
    expect(w.html()).not.toContain('v-html');
    expect(w.findAll('rect').length).toBe(3);
    // 颜色走 CSS 变量，不再出现裸 hex
    expect(w.html()).toMatch(/--chart-series-|var\(--/);
  });
  it('空数据渲染空态', () => {
    const w = mount(HtpBarChart, { props: { data: [] } });
    expect(w.find('.htp-chart-empty').text()).toBe('暂无数据');
    expect(w.find('svg').exists()).toBe(false);
  });
});

describe('HtpDonutChart', () => {
  const pie = [
    { label: '甲', value: 3 },
    { label: '乙', value: 5 },
    { label: '丙', value: 2 },
  ];
  it('渲染三段弧与中心文本', () => {
    const w = mount(HtpDonutChart, { props: { data: pie, centerText: '10' } });
    expect(w.findAll('path').length).toBe(3);
    expect(w.find('text').text()).toBe('10');
  });
  it('空数据渲染空态', () => {
    const w = mount(HtpDonutChart, { props: { data: [] } });
    expect(w.find('.htp-chart-empty').exists()).toBe(true);
  });
});

describe('HtpLineChart（S2-2b 挂载折线）', () => {
  it('渲染折线与数据点', () => {
    const w = mount(HtpLineChart, { props: { data: bars } });
    expect(w.find('polyline').exists()).toBe(true);
    expect(w.findAll('circle').length).toBe(3);
  });
  it('空数据不渲染折线', () => {
    const w = mount(HtpLineChart, { props: { data: [] } });
    expect(w.find('polyline').exists()).toBe(false);
  });
});

describe('HtpStackedBarChart', () => {
  it('按 series 堆叠渲染矩形', () => {
    const w = mount(HtpStackedBarChart, {
      props: {
        data: [
          { label: 'A', values: { 前端: 3, 后端: 4 } },
          { label: 'B', values: { 前端: 2, 后端: 5 } },
        ],
        series: [
          { key: '前端', label: '前端', color: 'var(--chart-series-1)' },
          { key: '后端', label: '后端', color: 'var(--chart-series-2)' },
        ],
      },
    });
    expect(w.findAll('rect').length).toBe(4);
  });
});

describe('HtpTimelineChart', () => {
  it('渲染里程碑节点与标签', () => {
    const w = mount(HtpTimelineChart, {
      props: {
        items: [
          { label: '立项', date: '2026-01-01' },
          { label: '交付', date: '2026-03-01' },
        ],
      },
    });
    expect(w.findAll('circle').length).toBe(2);
    expect(w.text()).toContain('立项');
  });
});

describe('HtpChartLegend', () => {
  it('渲染图例项', () => {
    const w = mount(HtpChartLegend, {
      props: { items: [{ label: '甲', color: 'var(--chart-series-1)' }, { label: '乙', color: 'var(--chart-series-2)' }] },
    });
    expect(w.findAll('.htd-chart-legend__item').length).toBe(2);
  });
  it('无图例项不渲染', () => {
    const w = mount(HtpChartLegend, { props: { items: [] } });
    expect(w.find('.htd-chart-legend').exists()).toBe(false);
  });
});
