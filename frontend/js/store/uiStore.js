/**
 * UI 全局状态：保存状态三态机（§5.3.2）
 * saved / saving / failed / idle，每次 API 请求前 → saving，成功 → saved（2.5s 回 idle），失败 → failed
 * 顶栏 StatusDot 数据源；由 api.js 在请求生命周期内自动驱动
 */
const useUiStore = Pinia.defineStore('ui', {
  state: () => ({
    saveState: 'idle', // idle | saving | saved | failed
    saveError: null,
    _timer: null,
    _savingDepth: 0,
  }),
  getters: {
    isSaving: (s) => s.saveState === 'saving',
    isFailed: (s) => s.saveState === 'failed',
  },
  actions: {
    setSaving() {
      this._clearTimer();
      this._savingDepth += 1;
      this.saveState = 'saving';
      this.saveError = null;
    },
    setSaved() {
      this._savingDepth = Math.max(0, this._savingDepth - 1);
      if (this._savingDepth > 0) return; // 仍有在途请求，保持 saving
      this.saveState = 'saved';
      this._timer = setTimeout(() => {
        if (this.saveState === 'saved') this.saveState = 'idle';
        this._timer = null;
      }, 2500);
    },
    setFailed(err) {
      this._savingDepth = Math.max(0, this._savingDepth - 1);
      this.saveState = 'failed';
      this.saveError = err && err.message ? err.message : (err ? String(err) : '保存失败');
    },
    reset() {
      this._clearTimer();
      this._savingDepth = 0;
      this.saveState = 'idle';
      this.saveError = null;
    },
    _clearTimer() {
      if (this._timer) {
        clearTimeout(this._timer);
        this._timer = null;
      }
    },
  },
});
window.useUiStore = useUiStore;
