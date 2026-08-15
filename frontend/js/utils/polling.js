// 指数退避轮询器：长任务进度查询用，失败按 2 的幂退避并封顶

// 长任务轮询：成功回调并可选择停止；失败指数退避（800→1600→3200→4800→封顶）
class ExponentialBackoffPoller {
  constructor({ fetchFn, onSuccess, onError, initialDelay = 800, maxDelay = 4800, stopOnSuccess = true }) {
    this.fetchFn = fetchFn;         // 每次轮询要执行的异步取数函数 -> Promise<result>
    this.onSuccess = onSuccess || (() => {});
    this.onError = onError || (() => {});
    this.initialDelay = initialDelay;
    this.maxDelay = maxDelay;
    this.stopOnSuccess = stopOnSuccess;
    this._timer = null;
    this._attempt = 0;              // 失败计数，从 0 起，每次失败 +1
    this._running = false;
  }

  // 启动轮询：先立即取一次，后续按成功/失败策略继续
  start() {
    if (this._running) return;
    this._running = true;
    this._attempt = 0;
    this._tick();
  }

  _tick() {
    if (!this._running) return;
    Promise.resolve()
      .then(() => this.fetchFn())
      .then((result) => {
        if (!this._running) return;
        this.onSuccess(result);
        if (this.stopOnSuccess) {
          this.stop();
        } else {
          this._attempt = 0;
          this._schedule(this.initialDelay);
        }
      })
      .catch((err) => {
        if (!this._running) return;
        this.onError(err);
        const nextDelay = Math.min(this.initialDelay * Math.pow(2, this._attempt), this.maxDelay);
        this._attempt += 1;
        this._schedule(nextDelay);
      });
  }

  _schedule(delay) {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      this._tick();
    }, delay);
  }

  // 停止轮询，清除定时器
  stop() {
    this._running = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}
