/**
 * charts.js - 轻量 SVG 图表工具（V1.5 §8.1）
 * 手写 SVG，无第三方图表库；主题自适应（颜色走 CSS 变量 / 固定可辨色板）；
 * 全部函数返回 SVG 字符串，由调用方通过 v-html 注入。
 * 支持：柱状图 / 环形图(饼图) / 折线图 / 堆叠柱状图 / 时间线。
 */
(function () {
  // 多分类固定色板（蓝系为主，避开紫粉装饰渐变红线）
  const PALETTE = ['var(--chart-series-1)', 'var(--chart-series-2)', 'var(--chart-series-3)', 'var(--chart-series-4)', 'var(--chart-series-5)', 'var(--chart-series-6)', 'var(--chart-series-7)', 'var(--chart-series-8)', 'var(--chart-series-9)', 'var(--chart-series-10)'];

  function colorAt(i) { return PALETTE[i % PALETTE.length]; }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 数值友好化：超过 1000 用 k
  function fmt(n) {
    if (n == null || isNaN(n)) return '0';
    const v = Number(n);
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'k';
    return String(v);
  }

  // ============ 柱状图 ============
  function barChart(opts) {
    const data = opts.data || [];
    const W = opts.width || 320;
    const H = opts.height || 160;
    const p = { top: 10, right: 8, bottom: 26, left: 30 };
    const chartW = W - p.left - p.right;
    const chartH = H - p.top - p.bottom;
    if (!data.length) return emptySvg(W, H, '暂无数据');
    const max = Math.max.apply(null, data.map((d) => Number(d.value) || 0).concat([1]));
    const n = data.length;
    const slot = chartW / n;
    const barW = Math.min(slot * 0.55, 40);
    const color = opts.color || 'var(--color-primary)';
    let bars = '';
    data.forEach((d, i) => {
      const v = Number(d.value) || 0;
      const bh = (v / max) * chartH;
      const x = p.left + i * slot + (slot - barW) / 2;
      const y = p.top + chartH - bh;
      bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(bh, 0.5).toFixed(1)}" rx="3" fill="${color}"></rect>`;
      const label = escapeHtml(d.label || '');
      const lx = p.left + i * slot + slot / 2;
      bars += `<text x="${lx.toFixed(1)}" y="${(H - 10).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--text-tertiary)">${truncate(label, 6)}</text>`;
      if (opts.showValue) {
        bars += `<text x="${lx.toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--text-secondary)">${fmt(v)}</text>`;
      }
    });
    // 基线
    const base = `<line x1="${p.left}" y1="${(p.top + chartH).toFixed(1)}" x2="${(W - p.right).toFixed(1)}" y2="${(p.top + chartH).toFixed(1)}" stroke="var(--border-default)" stroke-width="1"></line>`;
    return svgWrap(W, H, base + bars);
  }

  // ============ 环形图 / 饼图 ============
  function donutChart(opts) {
    const data = (opts.data || []).filter((d) => (Number(d.value) || 0) > 0);
    const W = opts.width || 180;
    const H = opts.height || 180;
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(W, H) / 2 - 6;
    const inner = r * (opts.innerRatio != null ? opts.innerRatio : 0.6);
    if (!data.length) return emptySvg(W, H, '暂无数据');
    const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
    if (data.length === 1) {
      // 单一分类：整圆
      const color = data[0].color || colorAt(0);
      const ring = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${(r - inner).toFixed(1)}"></circle>`;
      return svgWrap(W, H, ring + centerText(cx, cy, opts.centerText || fmt(total)));
    }
    let angle = -Math.PI / 2;
    let arcs = '';
    data.forEach((d, i) => {
      const frac = (Number(d.value) || 0) / total;
      const a2 = angle + frac * Math.PI * 2;
      const color = d.color || colorAt(i);
      arcs += arcPath(cx, cy, r, inner, angle, a2, color);
      angle = a2;
    });
    return svgWrap(W, H, arcs + centerText(cx, cy, opts.centerText || fmt(total)));
  }

  // ============ 折线图 ============
  function lineChart(opts) {
    const data = opts.data || [];
    const W = opts.width || 320;
    const H = opts.height || 160;
    const p = { top: 12, right: 10, bottom: 26, left: 30 };
    const chartW = W - p.left - p.right;
    const chartH = H - p.top - p.bottom;
    if (!data.length) return emptySvg(W, H, '暂无数据');
    const max = Math.max.apply(null, data.map((d) => Number(d.value) || 0).concat([1]));
    const min = Math.min.apply(null, data.map((d) => Number(d.value) || 0).concat([0]));
    const span = (max - min) || 1;
    const n = data.length;
    const slot = chartW / Math.max(n - 1, 1);
    const pts = data.map((d, i) => {
      const v = Number(d.value) || 0;
      const x = p.left + (n === 1 ? chartW / 2 : i * slot);
      const y = p.top + chartH - ((v - min) / span) * chartH;
      return [x, y];
    });
    const color = opts.color || 'var(--color-primary)';
    const polyline = pts.map((pt) => `${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join(' ');
    const area = `${p.left},${p.top + chartH} ${polyline} ${(p.left + (n === 1 ? chartW / 2 : (n - 1) * slot)).toFixed(1)},${p.top + chartH}`;
    let dots = '';
    let xlabels = '';
    pts.forEach((pt, i) => {
      dots += `<circle cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="2.6" fill="${color}"></circle>`;
      xlabels += `<text x="${pt[0].toFixed(1)}" y="${(H - 10).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--text-tertiary)">${truncate(escapeHtml(data[i].label || ''), 6)}</text>`;
    });
    const base = `<line x1="${p.left}" y1="${(p.top + chartH).toFixed(1)}" x2="${(W - p.right).toFixed(1)}" y2="${(p.top + chartH).toFixed(1)}" stroke="var(--border-default)" stroke-width="1"></line>`;
    const areaPath = `<polygon points="${area}" fill="${color}" fill-opacity="0.12" stroke="none"></polygon>`;
    const line = `<polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>`;
    return svgWrap(W, H, base + areaPath + line + dots + xlabels);
  }

  // ============ 堆叠柱状图 ============
  function stackedBarChart(opts) {
    const data = opts.data || [];
    const series = opts.series || [];
    const W = opts.width || 340;
    const H = opts.height || 180;
    const p = { top: 10, right: 8, bottom: 26, left: 32 };
    const chartW = W - p.left - p.right;
    const chartH = H - p.top - p.bottom;
    if (!data.length || !series.length) return emptySvg(W, H, '暂无数据');
    let maxTotal = 1;
    data.forEach((d) => {
      const t = series.reduce((s, ser) => s + (Number(d.values[ser.key]) || 0), 0);
      if (t > maxTotal) maxTotal = t;
    });
    const n = data.length;
    const slot = chartW / n;
    const barW = Math.min(slot * 0.55, 44);
    let bars = '';
    data.forEach((d, i) => {
      const x = p.left + i * slot + (slot - barW) / 2;
      let yCursor = p.top + chartH;
      series.forEach((ser) => {
        const v = Number(d.values[ser.key]) || 0;
        if (v <= 0) return;
        const segH = (v / maxTotal) * chartH;
        yCursor -= segH;
        bars += `<rect x="${x.toFixed(1)}" y="${yCursor.toFixed(1)}" width="${barW.toFixed(1)}" height="${segH.toFixed(1)}" fill="${ser.color || colorAt(series.indexOf(ser))}"></rect>`;
      });
      bars += `<text x="${(x + barW / 2).toFixed(1)}" y="${(H - 10).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--text-tertiary)">${truncate(escapeHtml(d.label || ''), 6)}</text>`;
    });
    const base = `<line x1="${p.left}" y1="${(p.top + chartH).toFixed(1)}" x2="${(W - p.right).toFixed(1)}" y2="${(p.top + chartH).toFixed(1)}" stroke="var(--border-default)" stroke-width="1"></line>`;
    return svgWrap(W, H, base + bars);
  }

  // ============ 时间线（横向） ============
  function timelineChart(opts) {
    const items = opts.items || [];
    const W = opts.width || 360;
    const H = opts.height || 120;
    if (!items.length) return emptySvg(W, H, '暂无里程碑');
    const p = { top: 20, bottom: 36, left: 16, right: 16 };
    const trackY = p.top + 8;
    const chartW = W - p.left - p.right;
    const n = items.length;
    const slot = chartW / n;
    let nodes = '';
    let axis = `<line x1="${p.left}" y1="${trackY}" x2="${(W - p.right).toFixed(1)}" y2="${trackY}" stroke="var(--border-default)" stroke-width="1.5"></line>`;
    items.forEach((it, i) => {
      const x = p.left + (n === 1 ? chartW / 2 : i * slot + slot / 2);
      const color = it.color || colorAt(i);
      const done = it.done === true;
      nodes += `<circle cx="${x.toFixed(1)}" cy="${trackY}" r="6" fill="${done ? color : 'var(--bg-card)'}" stroke="${color}" stroke-width="2"></circle>`;
      nodes += `<text x="${x.toFixed(1)}" y="${(trackY - 12).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--text-secondary)">${truncate(escapeHtml(it.label || ''), 8)}</text>`;
      if (it.date) {
        nodes += `<text x="${x.toFixed(1)}" y="${(trackY + 20).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--text-tertiary)">${escapeHtml(it.date)}</text>`;
      }
    });
    return svgWrap(W, H, axis + nodes);
  }

  // ============ 图例 ============
  function legend(items) {
    // items: [{label, color}]
    if (!items || !items.length) return '';
    const rows = items.map((it) => {
      const c = it.color || colorAt(0);
      return `<span class="htd-chart-legend__item"><span class="htd-chart-legend__dot" style="background:${c}"></span>${escapeHtml(it.label)}</span>`;
    }).join('');
    return `<div class="htd-chart-legend">${rows}</div>`;
  }

  // ============ 内部工具 ============
  function svgWrap(W, H, inner) {
    return `<svg class="htd-chart" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img">${inner}</svg>`;
  }
  function emptySvg(W, H, text) {
    return svgWrap(W, H, `<text x="${(W / 2).toFixed(1)}" y="${(H / 2).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--text-tertiary)">${escapeHtml(text)}</text>`);
  }
  function centerText(cx, cy, text) {
    return `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="600" fill="var(--text-primary)">${escapeHtml(text)}</text>`;
  }
  function truncate(s, max) {
    s = String(s == null ? '' : s);
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }
  function arcPath(cx, cy, r, inner, a1, a2, color) {
    const largeArc = (a2 - a1) > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy + r * Math.sin(a2);
    const xi2 = cx + inner * Math.cos(a2);
    const yi2 = cy + inner * Math.sin(a2);
    const xi1 = cx + inner * Math.cos(a1);
    const yi1 = cy + inner * Math.sin(a1);
    return `<path d="M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${xi2.toFixed(2)} ${yi2.toFixed(2)} A ${inner} ${inner} 0 ${largeArc} 0 ${xi1.toFixed(2)} ${yi1.toFixed(2)} Z" fill="${color}" stroke="var(--bg-card)" stroke-width="1.5"></path>`;
  }

  window.htdCharts = {
    PALETTE, colorAt, barChart, donutChart, lineChart, stackedBarChart, timelineChart, legend,
  };
})();
