/**
 * 前端工具函数 - 剪贴板复制
 */

async function copyToClipboard(text) {
  // 优先尝试 Clipboard API（安全上下文下可用）
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard API 失败，降级到 execCommand:', err);
    }
  }
  // 降级方案：textarea + execCommand
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch (err) {
    console.error('复制失败:', err);
    return false;
  }
}

window.htdCopy = { copyToClipboard };
