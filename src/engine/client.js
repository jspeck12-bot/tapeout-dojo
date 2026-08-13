// ============================================================
// ENGINE CLIENT — Worker with hard timeouts + main-thread fallback
//
// Same inputs/outputs as the sync core, but async. A new call supersedes
// any in-flight request (cancellation). Timeouts terminate the worker and
// spin up a fresh one so a runaway student design cannot freeze the tab.
// ============================================================

import { handleEngineRequest, ENGINE_TIMEOUTS, TIMEOUT_HINT, reviveMod } from './protocol.js';
import { serializeTest } from './core.js';

let _singleton = null;

function timeoutFor(op) {
  return ENGINE_TIMEOUTS[op] || 5000;
}

function timeoutError(op) {
  return {
    ok: false,
    error: {
      msg: `Engine timed out after ${timeoutFor(op)}ms — ${TIMEOUT_HINT}.`,
      hint: 'Look for a combinational loop (a signal that feeds itself with no register), or simplify the design.',
      code: 'TIMEOUT',
    },
  };
}

function createMainThreadClient() {
  let gen = 0;
  return {
    kind: 'main',
    async request(op, payload) {
      const id = ++gen;
      const msg = handleEngineRequest({ id, op, payload });
      if (msg.id !== id) return { ok: false, error: { msg: 'stale engine result discarded' } };
      return msg;
    },
    cancel() { gen += 1; },
    terminate() {},
  };
}

function createWorkerClient() {
  let worker = null;
  let gen = 0;
  const pending = new Map();

  const spawn = () => {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const msg = event.data;
      const waiter = pending.get(msg.id);
      if (!waiter) return;
      pending.delete(msg.id);
      waiter.resolve(msg);
    };
    worker.onerror = (err) => {
      for (const [id, waiter] of pending) {
        pending.delete(id);
        waiter.resolve({ id, ok: false, error: { msg: err.message || 'worker error' } });
      }
    };
  };
  spawn();

  const killPending = (reason) => {
    for (const [id, waiter] of pending) {
      pending.delete(id);
      waiter.resolve({ id, ok: false, error: reason });
    }
  };

  return {
    kind: 'worker',
    async request(op, payload) {
      const id = ++gen;
      // Cancellation: a newer request supersedes in-flight ones.
      // Terminate so a hung compile cannot block the replacement job.
      if (pending.size) {
        killPending({ msg: 'superseded', code: 'CANCELLED' });
        try { worker.terminate(); } catch (e) { /* ignore */ }
        spawn();
      }
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          try { worker.terminate(); } catch (e) { /* ignore */ }
          spawn();
          resolve({ id, op, ...timeoutError(op) });
        }, timeoutFor(op));
        pending.set(id, {
          resolve: (msg) => { clearTimeout(timer); resolve(msg); },
        });
        worker.postMessage({ id, op, payload });
      });
    },
    cancel() {
      gen += 1;
      killPending({ msg: 'cancelled', code: 'CANCELLED' });
    },
    terminate() {
      try { worker.terminate(); } catch (e) { /* ignore */ }
    },
  };
}

function createEngineClient() {
  if (typeof Worker === 'undefined') return createMainThreadClient();
  try {
    return createWorkerClient();
  } catch (e) {
    return createMainThreadClient();
  }
}

function getEngineClient() {
  if (!_singleton) _singleton = createEngineClient();
  return _singleton;
}

/** Force the main-thread fallback (tests / no-WebGL path). */
function createFallbackClient() {
  return createMainThreadClient();
}

async function engineRun(src, iface, test, want) {
  const client = getEngineClient();
  const msg = await client.request('run', {
    src,
    iface,
    test: serializeTest(test),
    want: want || ['compile', 'test', 'netlist', 'timing'],
  });
  if (msg.result && msg.result.compile && msg.result.compile.mod) {
    msg.result.mod = reviveMod(msg.result.compile.mod);
  }
  return msg;
}

export {
  getEngineClient,
  createEngineClient,
  createFallbackClient,
  createMainThreadClient,
  engineRun,
  serializeTest,
  reviveMod,
};
