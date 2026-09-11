import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HtpSkeleton from '../js/components/HtpSkeleton.vue';
import HtpSwitch from '../js/components/HtpSwitch.vue';
import HtpTable from '../js/components/HtpTable.vue';
import HtpDrawer from '../js/components/HtpDrawer.vue';
import HtpTooltip from '../js/components/HtpTooltip.vue';
import HtpMarkdownEditor from '../js/components/HtpMarkdownEditor.vue';

describe('HtpSkeleton', () => {
  it('渲染文本占位骨架（lines 行）', () => {
    const w = mount(HtpSkeleton, { props: { variant: 'text', lines: 4 } });
    expect(w.find('.htp-skeleton').exists()).toBe(true);
    expect(w.findAll('.htp-skeleton__line').length).toBe(4);
  });
  it('圆形变体加 circle 类', () => {
    const w = mount(HtpSkeleton, { props: { variant: 'circle' } });
    expect(w.find('.htp-skeleton__shape--circle').exists()).toBe(true);
  });
});

describe('HtpSwitch', () => {
  it('role=switch 且受控 v-model', async () => {
    const w = mount(HtpSwitch, { props: { modelValue: false } });
    expect(w.find('[role="switch"]').exists()).toBe(true);
    expect(w.attributes('aria-checked')).toBe('false');
    await w.find('button').trigger('click');
    expect(w.emitted('update:modelValue')[0]).toEqual([true]);
  });
  it('禁用时不触发切换', async () => {
    const w = mount(HtpSwitch, { props: { modelValue: false, disabled: true } });
    await w.find('button').trigger('click');
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });
});

describe('HtpTable', () => {
  const columns = [
    { key: 'name', title: '名称' },
    { key: 'val', title: '值' },
  ];
  const rows = [
    { id: 1, name: '甲', val: 10 },
    { id: 2, name: '乙', val: 20 },
  ];
  it('渲染表头与数据行', () => {
    const w = mount(HtpTable, { props: { columns, rows } });
    expect(w.findAll('th').length).toBe(2);
    expect(w.findAll('tbody tr').length).toBe(2);
    expect(w.text()).toContain('甲');
  });
  it('空数据显示空态文本', () => {
    const w = mount(HtpTable, { props: { columns, rows: [], emptyText: '空空如也' } });
    expect(w.find('.htp-table__empty').text()).toBe('空空如也');
  });
  it('loading 时渲染骨架单元格', () => {
    const w = mount(HtpTable, { props: { columns, rows, loading: true, skeletonRows: 3 } });
    expect(w.findAll('.htp-table__cell-skel').length).toBe(columns.length * 3);
  });
  it('分页点击派发 page-change', async () => {
    const w = mount(HtpTable, {
      props: { columns, rows, page: 1, pageSize: 10, total: 25 },
    });
    expect(w.find('.htp-table__page-info').text()).toBe('1 / 3');
    await w.findAll('.htp-table__page-btn')[1].trigger('click');
    expect(w.emitted('page-change')[0]).toEqual([2]);
  });
  it('具名插槽可定制单元格', () => {
    const w = mount(HtpTable, {
      props: { columns, rows },
      slots: { val: '<span class="custom">V{{ row.val }}</span>' },
    });
    expect(w.find('.custom').text()).toBe('V10');
  });
});

describe('HtpDrawer', () => {
  it('v-model 为 true 时挂载标题与内容', () => {
    const w = mount(HtpDrawer, {
      props: { modelValue: true, title: '抽屉标题' },
      slots: { default: '<p class="drawer-body">内容</p>' },
      attachTo: document.body,
    });
    const inDom = document.querySelector('.htp-drawer');
    expect(inDom).not.toBeNull();
    expect(document.querySelector('.htp-drawer__title').textContent).toBe('抽屉标题');
    expect(document.querySelector('.drawer-body').textContent).toBe('内容');
    w.unmount();
  });
  it('关闭派发 update:modelValue=false 与 close', async () => {
    const w = mount(HtpDrawer, { props: { modelValue: true, title: 'T' }, attachTo: document.body });
    await document.querySelector('.htp-drawer__close').click();
    expect(w.emitted('update:modelValue')[0]).toEqual([false]);
    expect(w.emitted('close')).toBeTruthy();
    w.unmount();
  });
});

describe('HtpTooltip', () => {
  it('默认渲染触发插槽', () => {
    const w = mount(HtpTooltip, {
      props: { content: '提示' },
      slots: { default: '<span class="trig">悬浮我</span>' },
    });
    expect(w.find('.trig').text()).toBe('悬浮我');
  });
  it('hover 后显示提示气泡', async () => {
    const w = mount(HtpTooltip, {
      props: { content: '提示文本' },
      slots: { default: '<span class="trig">x</span>' },
    });
    expect(w.find('.htp-tooltip__pop').exists()).toBe(false);
    await w.find('.htp-tooltip').trigger('mouseenter');
    expect(w.find('.htp-tooltip__pop').text()).toBe('提示文本');
  });
});

describe('HtpMarkdownEditor', () => {
  it('编辑输入派发 update:modelValue', async () => {
    const w = mount(HtpMarkdownEditor, { props: { modelValue: '' } });
    const ta = w.find('textarea');
    await ta.setValue('# 标题\n正文');
    expect(w.emitted('update:modelValue')[0]).toEqual(['# 标题\n正文']);
  });
  it('分屏预览渲染 markdown 为 HTML', async () => {
    const w = mount(HtpMarkdownEditor, { props: { modelValue: '**粗体**' } });
    const html = w.find('.htp-md__preview').html();
    expect(html).toContain('<strong>粗体</strong>');
  });
});
