// 草稿自动保存器：双层 timer（防抖 650ms + 2s 兜底）+ inFlight 队列竞态处理

// 自动保存器：防抖触发保存，2s 兜底强制 flush，并安全处理并发响应乱序
class DraftSaver {
  constructor({ saveFn, onState, debounceMs = 650, flushMs = 2000 }) {
    this.saveFn = saveFn;           // saveFn(revision, content) -> Promise<{ serverRevision }>
    this.onState = onState || (() => {}); // 把内部状态推给 UI
    this.debounceMs = debounceMs;
    this.flushMs = flushMs;
    this._timer = null;             // 防抖计时器（650ms）
    this._flushTimer = null;        // 兜底计时器（2s）
    this._inFlight = [];            // 在途请求队列：{ revision, promise }
    this._latestContent = '';
    this._destroyed = false;
  }

  // 输入变化入口：更新最新内容，重置防抖；若持续输入超过 flushMs 则强制发一次
  notifyChange(content) {
    if (this._destroyed) return;
    this._latestContent = content;
    this._clearTimer();
    this._timer = setTimeout(() => {
      this._timer = null;
      this.forceFlush();
    }, this.debounceMs);
    if (!this._flushTimer) {
      this._flushTimer = setTimeout(() => {
        this._flushTimer = null;
        this.forceFlush();
      }, this.flushMs);
    }
  }

  // 强制 flush：取消计时器，取最新内容 + 最新 revision，进入 SAVING 并发请求
  forceFlush() {
    if (this._destroyed) return Promise.resolve();
    this._clearTimer();
    const content = this._latestContent;
    // 没有待保存内容则视为无需保存
    if (content === '' && this._inFlight.length === 0) {
      this.onState({ status: 'pending', content, revision: this._revision || 0 });
      return Promise.resolve();
    }
    const revision = (this._revision || 0) + 1;
    this._revision = revision;
    this.onState({ status: 'saving', content, revision });
    const promise = Promise.resolve()
      .then(() => this.saveFn(revision, content))
      .then((res) => {
        // 旧响应竞态：若队列里某响应的 revision 比当前本地旧，丢弃不覆盖新内容
        const idx = this._inFlight.findIndex((x) => x.promise === promise);
        if (idx !== -1) this._inFlight.splice(idx, 1);
        if (revision < (this._revision || 0)) return; // 已有更新的本地保存，丢弃旧响应
        const serverRevision = (res && res.serverRevision) || revision;
        if (serverRevision >= (this._revision || 0)) {
          this.onState({ status: 'saved', content, revision, lastSavedAt: Date.now() });
        } else {
          this.onState({ status: 'failed', content, revision, error: 'revision mismatch' });
        }
      })
      .catch((err) => {
        const idx = this._inFlight.findIndex((x) => x.promise === promise);
        if (idx !== -1) this._inFlight.splice(idx, 1);
        if (revision < (this._revision || 0)) return;
        this.onState({ status: 'failed', content, revision, error: err });
      });
    this._inFlight.push({ revision, promise });
    return promise;
  }

  _clearTimer() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (this._flushTimer) { clearTimeout(this._flushTimer); this._flushTimer = null; }
  }

  // 销毁：清掉所有计时器，标记为已销毁，不再响应任何触发
  destroy() {
    this._clearTimer();
    this._inFlight = [];
    this._destroyed = true;
  }
}
