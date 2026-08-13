// Web Worker entry — runs the pure core off the main thread.
import { handleEngineRequest } from './protocol.js';

self.onmessage = (event) => {
  const msg = event.data;
  try {
    self.postMessage(handleEngineRequest(msg));
  } catch (e) {
    self.postMessage({
      id: msg && msg.id,
      op: msg && msg.op,
      ok: false,
      error: { msg: e.message || String(e), hint: null },
    });
  }
};
