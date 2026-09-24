/**
 * 通用进程内任务队列（零依赖）
 *
 * 职责边界：只管「排队、并发上限、超时、取消、统计」，与具体业务无关。
 * 任务状态以数据库为准（单一事实来源），本队列仅负责调度与背压，
 * 因此进程重启丢失内存队列不会造成状态不一致——遗留的 running/pending
 * 由调用方的启动恢复逻辑回收（见 job-runner.recoverStaleTasks）。
 *
 * 已知限制（设计取舍，非缺陷）：
 * 1. 只能取消「排队中」的任务；已开始执行无法中断（同步函数无法安全终止）。
 * 2. 超时是软超时：reject 并让出并发位，但同步函数仍会跑完才释放线程。
 *    超时主要防「调用方永久挂起」，不防 CPU 占用。
 */
export function createQueue({ concurrency = 2, timeoutMs = 30000 } = {}) {
  /** @type {Array<{id:string,fn:Function,resolve:Function,reject:Function}>} 排队中 */
  const queue = [];
  /** @type {Map<string, object>} 执行中 */
  const running = new Map();

  const limit = Math.max(1, Number(concurrency) || 1);
  const timeout = Math.max(1, Number(timeoutMs) || 1);

  /** 有空位就出队执行 */
  function pump() {
    while (running.size < limit && queue.length > 0) {
      start(queue.shift());
    }
  }

  function start(job) {
    const { id, fn, resolve, reject } = job;
    running.set(id, job);
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      running.delete(id);
      const err = new Error(`任务执行超时（超过 ${timeout}ms）`);
      err.code = 'TIMEOUT';
      reject(err);
      pump();
    }, timeout);

    const finish = (cb, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      running.delete(id);
      cb(value);
      pump();
    };

    // 用 Promise.resolve().then 保证 fn 抛出的同步异常也走 catch
    Promise.resolve()
      .then(() => fn())
      .then((v) => finish(resolve, v))
      .catch((e) => finish(reject, e));
  }

  /**
   * 入队。返回的 Promise 在「被调度执行后」才 resolve/reject。
   * @param {string} id 唯一标识（同一 id 重复入队视为重复提交）
   * @param {Function} fn 执行体
   * @returns {Promise<any>}
   */
  function enqueue(id, fn) {
    if (typeof fn !== 'function') {
      return Promise.reject(new Error('enqueue 需要 fn 函数'));
    }
    if (running.has(id) || queue.some((j) => j.id === id)) {
      const err = new Error('任务已在队列中或正在执行');
      err.code = 'DUPLICATE';
      return Promise.reject(err);
    }
    return new Promise((resolve, reject) => {
      queue.push({ id, fn, resolve, reject });
      pump();
    });
  }

  /**
   * 取消排队中的任务。
   * @returns {boolean} true=已从队列移除；false=不在队列中（正在执行或不存在）
   */
  function cancel(id) {
    const idx = queue.findIndex((j) => j.id === id);
    if (idx < 0) return false;
    const [job] = queue.splice(idx, 1);
    const err = new Error('任务已取消');
    err.code = 'CANCELLED';
    job.reject(err);
    return true;
  }

  /** 队列状态（可观测性） */
  function stats() {
    return { queued: queue.length, running: running.size, concurrency: limit, timeoutMs: timeout };
  }

  /** 该 id 是否仍在队列中（未开始执行） */
  function isQueued(id) {
    return queue.some((j) => j.id === id);
  }

  /** 该 id 是否正在执行 */
  function isRunning(id) {
    return running.has(id);
  }

  return { enqueue, cancel, stats, isQueued, isRunning };
}
