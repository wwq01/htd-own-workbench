// 草稿 5 态机（pending/saving/saved/failed/null）+ revision 单调递增，描述草稿保存生命周期

// 草稿状态枚举：待保存 / 保存中 / 已保存 / 失败 / 无（初始/空）
const DRAFT_STATUS = {
  PENDING: 'pending',
  SAVING: 'saving',
  SAVED: 'saved',
  FAILED: 'failed',
  NULL: null,
};

// 创建一份草稿状态对象，revision 从 0 起，lastSavedAt/error 初始为空
function createDraftState(initialContent) {
  return {
    status: DRAFT_STATUS.PENDING,
    content: initialContent || '',
    revision: 0,
    lastSavedAt: null,
    error: null,
  };
}

// 单调递增修订号，不允许回退；返回递增后的新 revision
function bumpRevision(state) {
  state.revision += 1;
  return state.revision;
}
