// FNV-1a 32位稳定哈希 → 稳定颜色/分组算法（纯位运算，离线可用，无依赖）

// 计算字符串的 FNV-1a 32位哈希，返回无符号整数（同一字符串恒等）
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// 把字符串映射到主题色板索引（palette 为颜色数组）。同一字符串每次结果一致，刷新不跳色。
function hashToColor(str, palette) {
  const idx = fnv1a(String(str)) % palette.length;
  return palette[idx];
}
