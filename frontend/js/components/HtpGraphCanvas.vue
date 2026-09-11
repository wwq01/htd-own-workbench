<script setup>
/**
 * HtpGraphCanvas.vue — S2-2c 知识图谱画布
 *
 * 设计要点（性能红线：1k 节点 ≥30fps）：
 *  1) 布局与渲染解耦：d3-force 只负责算坐标，Canvas 只负责每帧重绘；
 *     不用 SVG v-for（1k 节点的 Vue diff 会拖垮帧率）。
 *  2) 手动 rAF 驱动：forceSimulation().stop() 关掉 d3 内部 timer，
 *     由本组件的 requestAnimationFrame 循环调 sim.tick() + draw()，
 *     帧率可控、可测量、可在卸载时彻底释放。
 *  3) Token 单一来源：Canvas 无法直接用 var(--x)，故运行期从 :root 解析 CSS 变量，
 *     兜底值一律用 rgb()（避免裸 hex），主题切换后调 refreshTheme() 重新解析。
 *  4) 脏数据防御：source/target 指向不存在节点的 link 会被过滤，不让 d3-force 抛错。
 */
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force';

const TAU = Math.PI * 2;
const SERIES_COUNT = 8;
const FALLBACK_NODE = [
  'rgb(91, 141, 239)', 'rgb(52, 211, 153)', 'rgb(251, 191, 36)', 'rgb(248, 113, 113)',
  'rgb(167, 139, 250)', 'rgb(34, 211, 238)', 'rgb(251, 146, 60)', 'rgb(244, 114, 182)',
];
const FALLBACK_LINK = 'rgb(148, 163, 184)';
const FALLBACK_TEXT = 'rgb(203, 213, 225)';
const FALLBACK_BG = 'rgb(30, 41, 59)';

const props = defineProps({
  /** 节点：[{ id, label, group, size? }] */
  nodes: { type: Array, default: () => [] },
  /** 连线：[{ source, target }]，source/target 为节点 id */
  links: { type: Array, default: () => [] },
  width: { type: Number, default: 720 },
  height: { type: Number, default: 420 },
  /** 是否自动跑力导向动画 */
  running: { type: Boolean, default: true },
  /** 节点基础半径（size 存在时按 size 缩放） */
  nodeRadius: { type: Number, default: 5 },
  /** 超过该节点数自动关闭标签绘制（标签是 1k 节点下的主要开销） */
  labelThreshold: { type: Number, default: 80 },
  showLabels: { type: Boolean, default: true },
  linkDistance: { type: Number, default: 48 },
  chargeStrength: { type: Number, default: -70 },
  /** 是否允许拖拽节点 */
  draggable: { type: Boolean, default: true },
});

const emit = defineEmits(['node-click', 'node-hover', 'layout-end']);

const wrapRef = ref(null);
const canvasRef = ref(null);
const hoverId = ref(null);
const selectedId = ref(null);
const fps = ref(0);
const containerWidth = ref(0);

// 内部副本：d3-force 会原地 mutate 节点（写入 x/y/vx/vy），不能直接改 props
const sim = shallowRef(null);
const simNodes = shallowRef([]);
const simLinks = shallowRef([]);

let raf = 0;
let ro = null;
let frames = 0;
let fpsWindowStart = 0;
let palette = FALLBACK_NODE.slice();
let linkColor = FALLBACK_LINK;
let textColor = FALLBACK_TEXT;
let bgColor = FALLBACK_BG;
let dragNode = null;
let ended = false;

const size = computed(() => {
  const w = containerWidth.value > 0 ? containerWidth.value : props.width;
  return { W: w, H: props.height };
});

function cssVar(name, fallback) {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return fallback;
  let v = '';
  try {
    v = window.getComputedStyle(document.documentElement).getPropertyValue(name);
  } catch (_) {
    return fallback;
  }
  const s = (v || '').trim();
  return s || fallback;
}

/** 从 :root 解析一次配色（主题切换后重新调用即可） */
function refreshTheme() {
  palette = [];
  for (let i = 1; i <= SERIES_COUNT; i += 1) {
    palette.push(cssVar(`--chart-series-${i}`, FALLBACK_NODE[(i - 1) % FALLBACK_NODE.length]));
  }
  linkColor = cssVar('--text-tertiary', FALLBACK_LINK);
  textColor = cssVar('--text-secondary', FALLBACK_TEXT);
  bgColor = cssVar('--bg-card', FALLBACK_BG);
}

function measure() {
  const el = wrapRef.value;
  if (el && typeof el.clientWidth === 'number' && el.clientWidth > 0) {
    containerWidth.value = el.clientWidth;
  }
}

function radiusOf(n) {
  const base = props.nodeRadius;
  if (typeof n.size === 'number' && n.size > 0) return base + Math.min(8, Math.log2(n.size + 1) * 1.6);
  return base;
}

function colorOf(n) {
  if (n && typeof n.group === 'number') return palette[n.group % palette.length];
  if (n && typeof n.group === 'string') {
    let h = 0;
    for (let i = 0; i < n.group.length; i += 1) h = (h * 31 + n.group.charCodeAt(i)) % 997;
    return palette[h % palette.length];
  }
  return palette[0];
}

/** 过滤掉端点不存在的连线，避免 forceLink 抛 node not found */
function sanitize(nodes, links) {
  const idSet = new Set(nodes.map((n) => n.id));
  return links.filter((l) => l && idSet.has(l.source) && idSet.has(l.target));
}

function buildSim() {
  const nodes = (props.nodes || []).map((n) => ({ ...n }));
  const links = sanitize(nodes, props.links || []).map((l) => ({ ...l }));
  simNodes.value = nodes;
  simLinks.value = links;

  if (sim.value) {
    sim.value.stop();
    sim.value.on('tick', null);
    sim.value = null;
  }
  ended = false;
  if (!nodes.length) return;

  const { W, H } = size.value;
  const s = forceSimulation(nodes)
    .force('link', forceLink(links).id((d) => d.id).distance(props.linkDistance).strength(0.35))
    .force('charge', forceManyBody().strength(props.chargeStrength).distanceMax(320).theta(0.9))
    .force('center', forceCenter(W / 2, H / 2))
    .force('collide', forceCollide((d) => radiusOf(d) + 2).iterations(1))
    .alphaDecay(0.028)
    .velocityDecay(0.42)
    .stop();
  sim.value = s;
}

function draw() {
  const cv = canvasRef.value;
  if (!cv || typeof cv.getContext !== 'function') return;
  const ctx = cv.getContext('2d');
  if (!ctx) return; // jsdom / 无 canvas 环境安全跳过

  const { W, H } = size.value;
  const dpr = Math.min(typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1, 2);
  const pw = Math.round(W * dpr);
  const ph = Math.round(H * dpr);
  if (cv.width !== pw || cv.height !== ph) {
    cv.width = pw;
    cv.height = ph;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const links = simLinks.value;
  const nodes = simNodes.value;

  // 连线：一次性 path 批量描边（1k 边也只有一次 stroke 调用）
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = linkColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < links.length; i += 1) {
    const s = links[i].source;
    const t = links[i].target;
    if (!s || !t || typeof s !== 'object' || typeof t !== 'object') continue;
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 节点
  const showLabel = props.showLabels && nodes.length <= props.labelThreshold;
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i];
    const r = radiusOf(n);
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, TAU);
    ctx.fillStyle = colorOf(n);
    ctx.fill();
    if (n.id === hoverId.value || n.id === selectedId.value) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = textColor;
      ctx.stroke();
    }
    if (showLabel && n.label) {
      ctx.fillStyle = textColor;
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(String(n.label), n.x + r + 3, n.y + 3);
    }
  }

  // 悬停节点加背景高亮条，保证文字可读
  if (hoverId.value != null && showLabel) {
    const hn = nodes.find((n) => n.id === hoverId.value);
    if (hn) {
      ctx.fillStyle = bgColor;
      ctx.font = '11px system-ui, sans-serif';
      const tw = ctx.measureText(String(hn.label || '')).width;
      ctx.fillRect(hn.x + radiusOf(hn) + 1, hn.y - 6, tw + 6, 14);
      ctx.fillStyle = textColor;
      ctx.fillText(String(hn.label || ''), hn.x + radiusOf(hn) + 4, hn.y + 4);
    }
  }
}

function tick() {
  const s = sim.value;
  if (!s) return;
  s.tick();
  draw();
  if (!ended && s.alpha() < 0.005) {
    ended = true;
    emit('layout-end');
  }
}

function loop(ts) {
  raf = requestAnimationFrame(loop);
  if (!props.running || !sim.value) return;
  if (!ended || dragNode) {
    tick();
  } else {
    draw();
  }
  frames += 1;
  if (!fpsWindowStart) fpsWindowStart = ts;
  if (ts - fpsWindowStart >= 500) {
    fps.value = Math.round((frames * 1000) / (ts - fpsWindowStart));
    frames = 0;
    fpsWindowStart = ts;
  }
}

function start() {
  if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
  raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(loop) : 0;
}

function restart() {
  if (sim.value) {
    sim.value.alpha(1);
    ended = false;
  }
  start();
}

function stop() {
  if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
  raf = 0;
}

/** 命中测试：返回距离 (x,y) 最近的节点（未命中返回 null） */
function hitTest(x, y) {
  const nodes = simNodes.value;
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i];
    const dx = n.x - x;
    const dy = n.y - y;
    const d = dx * dx + dy * dy;
    const rr = radiusOf(n) + 4;
    if (d <= rr * rr && d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

function pointFromEvent(e) {
  const cv = canvasRef.value;
  if (!cv || typeof cv.getBoundingClientRect !== 'function') return { x: 0, y: 0 };
  const rect = cv.getBoundingClientRect();
  return { x: (e.clientX || 0) - rect.left, y: (e.clientY || 0) - rect.top };
}

function onMove(e) {
  if (dragNode) {
    const p = pointFromEvent(e);
    dragNode.fx = p.x;
    dragNode.fy = p.y;
    if (ended) draw();
    return;
  }
  const p = pointFromEvent(e);
  const hit = hitTest(p.x, p.y);
  const id = hit ? hit.id : null;
  if (id !== hoverId.value) {
    hoverId.value = id;
    emit('node-hover', hit);
    if (ended) draw();
  }
}

function onDown(e) {
  if (!props.draggable) return;
  const p = pointFromEvent(e);
  const hit = hitTest(p.x, p.y);
  if (!hit) return;
  dragNode = hit;
  hit.fx = hit.x;
  hit.fy = hit.y;
  if (sim.value) sim.value.alphaTarget(0.15).alpha(0.4);
  ended = false;
}

function onUp() {
  if (dragNode) {
    dragNode.fx = null;
    dragNode.fy = null;
    dragNode = null;
  }
  if (sim.value) sim.value.alphaTarget(0);
}

function onClick(e) {
  const p = pointFromEvent(e);
  const hit = hitTest(p.x, p.y);
  selectedId.value = hit ? hit.id : null;
  emit('node-click', hit);
  if (ended) draw();
}

onMounted(() => {
  refreshTheme();
  measure();
  buildSim();
  start();
  if (typeof ResizeObserver !== 'undefined' && wrapRef.value) {
    ro = new ResizeObserver(() => {
      measure();
      if (sim.value) {
        const { W, H } = size.value;
        sim.value.force('center', forceCenter(W / 2, H / 2));
        sim.value.alpha(0.3);
        ended = false;
      }
    });
    ro.observe(wrapRef.value);
  }
});

onBeforeUnmount(() => {
  stop();
  if (ro) {
    ro.disconnect();
    ro = null;
  }
  if (sim.value) {
    sim.value.stop();
    sim.value.on('tick', null);
    sim.value = null;
  }
});

watch(
  () => [props.nodes, props.links],
  () => {
    buildSim();
    start();
  },
);

watch(() => [props.nodeRadius, props.linkDistance, props.chargeStrength], () => {
  if (sim.value) {
    const { W, H } = size.value;
    sim.value.force('link', forceLink(simLinks.value).id((d) => d.id).distance(props.linkDistance).strength(0.35));
    sim.value.force('charge', forceManyBody().strength(props.chargeStrength).distanceMax(320).theta(0.9));
    sim.value.force('center', forceCenter(W / 2, H / 2));
    sim.value.alpha(0.6);
    ended = false;
  }
});

watch(() => props.running, (v) => {
  if (v) restart();
});

defineExpose({
  tick,
  draw,
  restart,
  stop,
  hitTest,
  refreshTheme,
  fps,
  get simNodes() { return simNodes.value; },
  get simLinks() { return simLinks.value; },
  get simulation() { return sim.value; },
});
</script>

<template>
  <div ref="wrapRef" class="htp-graph" :style="{ height: height + 'px' }">
    <canvas
      ref="canvasRef"
      class="htp-graph__canvas"
      :style="{ width: '100%', height: height + 'px' }"
      @mousemove="onMove"
      @mousedown="onDown"
      @mouseup="onUp"
      @mouseleave="onUp"
      @click="onClick"
    ></canvas>
    <p v-if="!nodes.length" class="htp-graph__empty">暂无节点，添加条目后自动生成知识图谱</p>
    <div v-else-if="nodes.length > labelThreshold" class="htp-graph__hint">
      {{ nodes.length }} 个节点（已隐藏标签以保证帧率）
    </div>
  </div>
</template>

<style scoped>
.htp-graph {
  position: relative;
  width: 100%;
  border-radius: var(--radius-md, 12px);
  background: var(--bg-card);
  overflow: hidden;
}
.htp-graph__canvas {
  display: block;
  cursor: grab;
}
.htp-graph__canvas:active {
  cursor: grabbing;
}
.htp-graph__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  color: var(--text-tertiary);
  font-size: 12px;
}
.htp-graph__hint {
  position: absolute;
  left: 8px;
  bottom: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  font-size: 11px;
  pointer-events: none;
}
</style>
