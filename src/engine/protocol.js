// ============================================================
// ENGINE MESSAGE PROTOCOL
// Typed request/response for the Worker wrapper. The handler is
// synchronous and DOM-free so Node tests (and the gate) call it directly.
//
// ops: compile | runTest | netlist | timing | export | run
// Every request carries `id` so in-flight replies cannot be mismatched.
// ============================================================

import { vCompile, runChallengeTest, serializeTest } from './core.js';
import { netlistOf, levelizeNetlist } from './netlist.js';
import { exportRTL } from './rtl.js';
import { analyzeTiming } from './timing.js';

export const ENGINE_TIMEOUTS = {
  compile: 2000,
  runTest: 5000,
  netlist: 2000,
  timing: 2000,
  export: 5000,
  run: 5000,
};

export const TIMEOUT_HINT =
  "your design didn't settle; check for a combinational loop";

function reviveError(e) {
  return {
    line: e.line || 0,
    msg: e.message || String(e),
    hint: e.hint || null,
    signals: e.signals || null,
    code: e.code || null,
  };
}

function serializeMod(mod) {
  if (!mod) return null;
  return {
    name: mod.name,
    line: mod.line,
    ports: mod.ports,
    warnings: mod.warnings,
    assigns: mod.assigns,
    blocks: mod.blocks,
    signals: [...mod.signals.entries()],
    params: [...mod.params.entries()],
  };
}

function reviveMod(data) {
  if (!data) return null;
  if (data.signals instanceof Map) return data;
  return {
    ...data,
    signals: new Map(data.signals),
    params: new Map(data.params),
  };
}

function compilePayload(src, iface) {
  const compiled = vCompile(src, iface);
  if (!compiled.ok) {
    return { ok: false, errors: compiled.errors, warnings: compiled.warnings || [], mod: null };
  }
  return {
    ok: true,
    errors: [],
    warnings: compiled.warnings || [],
    mod: serializeMod(compiled.mod),
    _mod: compiled.mod,
  };
}

function handleEngineRequest(msg) {
  const { id, op, payload } = msg || {};
  try {
    if (op === 'compile') {
      const r = compilePayload(payload.src, payload.iface);
      return { id, op, ok: r.ok, result: { errors: r.errors, warnings: r.warnings, mod: r.mod } };
    }
    if (op === 'runTest') {
      const r = compilePayload(payload.src, payload.iface);
      if (!r.ok) return { id, op, ok: false, result: { compile: r, test: null } };
      const test = payload.test && payload.test.type ? payload.test : serializeTest(payload.test);
      const testResult = runChallengeTest(r._mod, test);
      return { id, op, ok: true, result: { compile: { ok: true, errors: [], warnings: r.warnings, mod: r.mod }, test: testResult } };
    }
    if (op === 'netlist') {
      const r = compilePayload(payload.src, payload.iface);
      if (!r.ok) return { id, op, ok: false, result: { compile: r, netlist: null, layout: null } };
      const net = netlistOf(r._mod);
      return { id, op, ok: true, result: { compile: { ok: true, warnings: r.warnings, mod: r.mod }, netlist: net, layout: levelizeNetlist(net) } };
    }
    if (op === 'timing') {
      const r = compilePayload(payload.src, payload.iface);
      if (!r.ok) return { id, op, ok: false, result: { compile: r, timing: null } };
      return { id, op, ok: true, result: { compile: { ok: true, warnings: r.warnings, mod: r.mod }, timing: analyzeTiming(r._mod) } };
    }
    if (op === 'export') {
      const ch = payload.challenge;
      const exported = exportRTL({
        ...ch,
        test: ch.test && ch.test.type === 'seq' ? serializeTest(ch.test) : ch.test,
      });
      return { id, op, ok: true, result: exported };
    }
    if (op === 'run') {
      const want = new Set(payload.want || ['compile', 'test', 'netlist', 'timing']);
      const r = compilePayload(payload.src, payload.iface);
      const out = { compile: { ok: r.ok, errors: r.errors, warnings: r.warnings, mod: r.mod } };
      if (!r.ok) return { id, op, ok: false, result: out };
      if (want.has('test') && payload.test) {
        const test = payload.test.type ? payload.test : serializeTest(payload.test);
        out.test = runChallengeTest(r._mod, test);
      }
      if (want.has('netlist')) {
        out.netlist = netlistOf(r._mod);
        try { out.layout = levelizeNetlist(out.netlist); } catch (e) { out.layoutError = e.message; }
      }
      if (want.has('timing')) {
        out.timing = analyzeTiming(r._mod);
      }
      return { id, op, ok: true, result: out };
    }
    return { id, op, ok: false, error: { msg: `unknown op '${op}'` } };
  } catch (e) {
    return { id, op, ok: false, error: reviveError(e) };
  }
}

export { handleEngineRequest, serializeMod, reviveMod, serializeTest };
