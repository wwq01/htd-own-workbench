/**
 * chartGeometry.js - S2-2a 图表几何计算（纯函数，ESM）
 *
 * 由 charts.js 的字符串拼装逻辑重构而来，返回结构化坐标数据，
 * 供 Htp*Chart.vue 用 v-for 响应式渲染，根治 P0-3「字符串拼接 + v-html」机制债。
 * 算法与旧 charts.js 完全一致，保证视觉无回归。
 */
export const PALETTE = [
  'var(--chart-series-1)', 'var(--chart-series-2)', 'var(--chart-series-3)',
  'var(--chart-series-4)', 'var(--chart-series-5)', 'var(--chart-series-6)',
  'var(--chart-series-7)', 'var(--chart-series-8)', 'var(--chart-series-9)',
  'var(--chart-series-10)',
];

export function colorAt(i) { return PALETTE[i % PALETTE.length]; }

export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fmt(n) {
  if (n == null || isNaN(n)) return '0';
  const v = Number(n);
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'k';
  return String(v);
}

export function truncate(s, max) {
  s = String(s == null ? '' : s);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function arcPath(cx, cy, r, inner, a1, a2) {
  const largeArc = (a2 - a1) > Math.PI ? 1 : 0;
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2);
  const y2 = cy + r * Math.sin(a2);
  const xi2 = cx + inner * Math.cos(a2);
  const yi2 = cy + inner * Math.sin(a2);
  const xi1 = cx + inner * Math.cos(a1);
  const yi1 = cy + inner * Math.sin(a1);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${xi2.toFixed(2)} ${yi2.toFixed(2)} A ${inner} ${inner} 0 ${largeArc} 0 ${xi1.toFixed(2)} ${yi1.toFixed(2)} Z`;
}

// ============ 柱状图 ============
export function barGeometry(opts = {}) {
  const data = opts.data || [];
  const W = opts.width || 320;
  const H = opts.height || 160;
  const p = { top: 10, right: 8, bottom: 26, left: 30 };
  const chartW = W - p.left - p.right;
  const chartH = H - p.top - p.bottom;
  if (!data.length) return { W: 0, H: 0 };
  const max = Math.max.apply(null, data.map((d) => Number(d.value) || 0).concat([1]));
  const n = data.length;
  const slot = chartW / n;
  const barW = Math.min(slot * 0.55, 40);
  const color = opts.color || 'var(--color-primary)';
  const bars = [];
  const labels = [];
  const values = [];
  data.forEach((d, i) => {
    const v = Number(d.value) || 0;
    const bh = (v / max) * chartH;
    const x = p.left + i * slot + (slot - barW) / 2;
    const y = p.top + chartH - bh;
    bars.push({ x, y, w: barW, h: Math.max(bh, 0.5), color });
    labels.push({ x: p.left + i * slot + slot / 2, y: H - 10, text: escapeHtml(d.label || '') });
    if (opts.showValue) values.push({ x: p.left + i * slot + slot / 2, y: y - 3, text: fmt(v) });
  });
  const base = { x1: p.left, y1: p.top + chartH, x2: W - p.right, y2: p.top + chartH };
  return { W, H, bars, labels, values, base };
}

// ============ 环形图 / 饼图 ============
export function donutGeometry(opts = {}) {
  const data = (opts.data || []).filter((d) => (Number(d.value) || 0) > 0);
  const W = opts.width || 180;
  const H = opts.height || 180;
  const cx = W / 2, cy = H / 2;
  const r = Math.min(W, H) / 2 - 6;
  const inner = r * (opts.innerRatio != null ? opts.innerRatio : 0.6);
  if (!data.length) return { W: 0, H: 0 };
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const center = { x: cx, y: cy, text: opts.centerText || fmt(total) };
  if (data.length === 1) {
    const color = data[0].color || colorAt(0);
    return { W, H, cx, cy, r, inner, single: { color }, arcs: [], center };
  }
  let angle = -Math.PI / 2;
  const arcs = [];
  data.forEach((d, i) => {
    const frac = (Number(d.value) || 0) / total;
    const a2 = angle + frac * Math.PI * 2;
    const color = d.color || colorAt(i);
    arcs.push({ path: arcPath(cx, cy, r, inner, angle, a2), color });
    angle = a2;
  });
  return { W, H, cx, cy, r, inner, single: null, arcs, center };
}

// ============ 折线图 ============
export function lineGeometry(opts = {}) {
  const data = opts.data || [];
  const W = opts.width || 320;
  const H = opts.height || 160;
  const p = { top: 12, right: 10, bottom: 26, left: 30 };
  const chartW = W - p.left - p.right;
  const chartH = H - p.top - p.bottom;
  if (!data.length) return { W: 0, H: 0 };
  const max = Math.max.apply(null, data.map((d) => Number(d.value) || 0).concat([1]));
  const min = Math.min.apply(null, data.map((d) => Number(d.value) || 0).concat([0]));
  const span = (max - min) || 1;
  const n = data.length;
  const slot = chartW / Math.max(n - 1, 1);
  const pts = data.map((d, i) => {
    const v = Number(d.value) || 0;
    const x = p.left + (n === 1 ? chartW / 2 : i * slot);
    const y = p.top + chartH - ((v - min) / span) * chartH;
    return { x, y };
  });
  const color = opts.color || 'var(--color-primary)';
  const polyline = pts.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
  const area = `${p.left},${p.top + chartH} ${polyline} ${(p.left + (n === 1 ? chartW / 2 : (n - 1) * slot)).toFixed(1)},${p.top + chartH}`;
  const dots = pts.map((pt) => ({ x: pt.x, y: pt.y }));
  const labels = pts.map((pt, i) => ({ x: pt.x, y: H - 10, text: truncate(escapeHtml(data[i].label || ''), 6) }));
  const base = { x1: p.left, y1: p.top + chartH, x2: W - p.right, y2: p.top + chartH };
  return { W, H, color, polyline, area, dots, labels, base };
}

// ============ 堆叠柱状图 ============
export function stackedGeometry(opts = {}) {
  const data = opts.data || [];
  const series = opts.series || [];
  const W = opts.width || 340;
  const H = opts.height || 180;
  const p = { top: 10, right: 8, bottom: 26, left: 32 };
  const chartW = W - p.left - p.right;
  const chartH = H - p.top - p.bottom;
  if (!data.length || !series.length) return { W: 0, H: 0 };
  let maxTotal = 1;
  data.forEach((d) => {
    const t = series.reduce((s, ser) => s + (Number(d.values[ser.key]) || 0), 0);
    if (t > maxTotal) maxTotal = t;
  });
  const n = data.length;
  const slot = chartW / n;
  const barW = Math.min(slot * 0.55, 44);
  const bars = [];
  const labels = [];
  data.forEach((d, i) => {
    const x = p.left + i * slot + (slot - barW) / 2;
    let yCursor = p.top + chartH;
    series.forEach((ser, si) => {
      const v = Number(d.values[ser.key]) || 0;
      const segH = (v / maxTotal) * chartH;
      yCursor -= segH;
      bars.push({ x, y: yCursor, w: barW, h: segH, color: ser.color || colorAt(si) });
    });
    labels.push({ x: x + barW / 2, y: H - 10, text: escapeHtml(d.label || '') });
  });
  const base = { x1: p.left, y1: p.top + chartH, x2: W - p.right, y2: p.top + chartH };
  return { W, H, bars, labels, base };
}

// ============ 时间线（横向） ============
export function timelineGeometry(opts = {}) {
  const items = opts.items || [];
  const W = opts.width || 360;
  const H = opts.height || 120;
  if (!items.length) return { W: 0, H: 0 };
  const p = { top: 20, bottom: 36, left: 16, right: 16 };
  const trackY = p.top + 8;
  const chartW = W - p.left - p.right;
  const n = items.length;
  const slot = chartW / n;
  const axis = { x1: p.left, y1: trackY, x2: W - p.right, y2: trackY };
  const nodes = [];
  const labels = [];
  const dates = [];
  items.forEach((it, i) => {
    const x = p.left + (n === 1 ? chartW / 2 : i * slot + slot / 2);
    const color = it.color || colorAt(i);
    const done = it.done === true;
    nodes.push({ x, y: trackY, r: 6, fill: done ? color : 'var(--bg-card)', stroke: color });
    labels.push({ x, y: trackY - 12, text: escapeHtml(it.label || '') });
    if (it.date) dates.push({ x, y: trackY + 20, text: escapeHtml(it.date) });
  });
  return { W, H, axis, nodes, labels, dates };
}
