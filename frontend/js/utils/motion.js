// 阻尼动效工具：按通道区分动画时长，替代「transition: all」，避免无关属性一起动画

// 单帧时长（约 60fps 一帧），留作速率换算参考
const TAU = 1000 / 60;

// 不同动效通道的基准时长（单位 ms）：颜色 / 布局 / 弹窗 / 反馈
const CHANNELS = { COLOR: 200, LAYOUT: 260, MODAL: 320, FEEDBACK: 180 };

// 缓动曲线：ease-out 三次方，t 为 0~1 进度，返回 0~1 缓动值
function dampingEasing(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.pow(1 - t, 3);
}

// 取某通道的动画时长；reduced 为 true（用户偏好减少动效）时直接返回 0，即无动画
function motionDuration(channel, reduced) {
  return reduced ? 0 : (CHANNELS[channel] || CHANNELS.FEEDBACK);
}
