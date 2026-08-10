/**
 * 前端工具函数 - 日期处理
 */

function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTime(date) {
  const d = new Date(date);
  const dateStr = formatDate(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}`;
}

function today() {
  return formatDate(new Date());
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDate(d);
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDate(d);
}

function daysBetween(dateA, dateB) {
  const d1 = new Date(formatDate(dateA)).getTime();
  const d2 = new Date(formatDate(dateB)).getTime();
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function getWeekdayName(date = new Date()) {
  const names = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return names[new Date(date).getDay()];
}

function relativeTime(date) {
  if (!date) return '';
  const now = new Date();
  const target = new Date(date);
  const diff = target - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}天前`;
  if (days === 0) return '今天';
  if (days === 1) return '明天';
  if (days === 2) return '后天';
  if (days <= 7) return `${days}天后`;
  return formatDate(date);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 9) return '早上好';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  if (hour < 22) return '晚上好';
  return '夜深了';
}

window.htdDate = { formatDate, formatDateTime, today, tomorrow, yesterday, getWeekdayName, relativeTime, daysBetween, getGreeting };
