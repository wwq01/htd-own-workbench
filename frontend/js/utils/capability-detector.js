// 模块能力探测器：从模块 meta 中提取值为 true 的能力键数组

// 接收模块 meta（如 { hasLogs:true, hasReview:false, hasFinance:false }），
// 返回其中值为 true 的能力键数组；不存在的能力视为 false。
function getModuleCapabilities(moduleMeta) {
  if (!moduleMeta || typeof moduleMeta !== 'object') return [];
  return Object.keys(moduleMeta).filter((key) => moduleMeta[key] === true);
}
