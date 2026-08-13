// ============================================================
// STATIC TIMING ANALYSIS
//
// Educational unit-delay-plus-fanout model. NOT sign-off-grade.
// Wire delay is ignored (called out below). Sequential elements cut the
// graph; combinational loops and latches are reported as errors, never hung.
// ============================================================

import { netlistOf } from './netlist.js';

/**
 * Delay constants — one table, the whole model.
 *
 * Units are dimensionless "delay units". Converted to nanoseconds via
 * `unitNs` so a 1-unit inverter is 50ps. Fanout adds `fanoutLoad` units
 * per destination pin on the driving gate.
 *
 * ADD/SUB/MUL scale with bit-width because the inferred operator is modeled
 * as a ripple chain. An explicit carry-lookahead written from gates can beat
 * that — that's the lesson.
 *
 * DISCLAIMER: wire delay is ignored. No parasitics, no drive strength, no
 * library. This exists to teach critical-path intuition, not to tape out.
 */
export const DELAY_MODEL = {
  disclaimer:
    'Educational unit-delay-plus-fanout model. Wire delay is ignored. Not sign-off-grade.',
  unitNs: 0.05,
  fanoutLoad: 0.35,
  setup: 1.2,
  clkToQ: 1.5,
  hold: 0.4,
  targetPeriodUnits: 24,
  base: {
    NOT: 1, NEG: 1, RED: 1.2,
    AND: 2, OR: 2,
    XOR: 3, XNOR: 3,
    MUX: 2.2,
    ADD: 3.2, SUB: 3.2, MUL: 6, DIV: 10, MOD: 8,
    SHL: 1.4, SHR: 1.4,
    CMP: 2.4,
    SLICE: 0.15, CAT: 0.2, REPL: 0.2,
    CONST: 0, IN: 0, OUT: 0.1,
    DFF: 0, LATCH: 0, PROC: 5, NET: 0.4, NC: 0,
  },
};

const SEQ = new Set(['DFF', 'LATCH']);
const SOURCE = new Set(['IN', 'CONST', 'DFF', 'LATCH', 'NC']);

function baseDelay(node) {
  const b = DELAY_MODEL.base[node.type] ?? 2;
  if (node.type === 'ADD' || node.type === 'SUB' || node.type === 'MUL') {
    return b * Math.max(1, node.w || 1);
  }
  return b;
}

function fanoutOf(nodes) {
  const fo = new Array(nodes.length).fill(0);
  for (const n of nodes) {
    (n.ins || []).forEach((src, k) => {
      if (src == null) return;
      if (n.fbIns && n.fbIns.includes(k)) return;
      fo[src] += 1;
    });
  }
  return fo;
}

function nodeDelay(node, fanout) {
  if (SOURCE.has(node.type) && node.type !== 'DFF' && node.type !== 'LATCH') return 0;
  return baseDelay(node) + DELAY_MODEL.fanoutLoad * (fanout[node.id] || 0);
}

function pathReport(nodes, ids, delay) {
  return {
    delay,
    delayNs: delay * DELAY_MODEL.unitNs,
    nodes: ids.map((id) => ({
      id,
      type: nodes[id].type,
      label: nodes[id].label,
      w: nodes[id].w,
    })),
    stages: ids.map((id) => `${nodes[id].type}${nodes[id].label ? '(' + nodes[id].label + ')' : ''}`),
  };
}

function slackOf(delay, extra = 0) {
  const period = DELAY_MODEL.targetPeriodUnits;
  const need = delay + extra;
  return { period, need, slack: period - need };
}

/**
 * Walk the netlist as a DAG, cut at sequential elements, report the four
 * standard path groups. Loops/latches become errors rather than infinite walks.
 */
function analyzeNetlist(net) {
  const nodes = net.nodes;
  const n = nodes.length;
  const fo = fanoutOf(nodes);
  const errors = [];

  if (net.latched && net.latched.length) {
    errors.push({
      code: 'LATCH',
      msg: `Level-sensitive latch inferred on ${net.latched.join(', ')} — timing model will not sign off a latch.`,
      signals: net.latched,
    });
  }
  const netLoops = nodes.filter((nd) => nd.type === 'NET');
  if (netLoops.length) {
    errors.push({
      code: 'COMB_LOOP',
      msg: `Combinational timing loop through ${netLoops.map((nd) => nd.label || nd.id).join(', ')}.`,
      signals: netLoops.map((nd) => nd.label || String(nd.id)),
    });
  }

  const combPred = (node) => {
    const preds = [];
    (node.ins || []).forEach((src, k) => {
      if (src == null) return;
      if (node.fbIns && node.fbIns.includes(k)) return;
      preds.push(src);
    });
    return preds;
  };

  // arrival[i] = { delay, pred, fromKind } along combinational cones.
  // Sequential / primary-input nodes are sources with delay 0 (plus Tcq for DFF).
  const arrivalIn = new Array(n);      // from primary inputs
  const arrivalReg = new Array(n);     // from register Q
  const visiting = new Set();
  const seen = new Set();

  function walk(id, fromReg) {
    const cache = fromReg ? arrivalReg : arrivalIn;
    if (cache[id]) return cache[id];
    if (visiting.has(id)) {
      errors.push({
        code: 'COMB_LOOP',
        msg: `Combinational timing loop through ${nodes[id].type} '${nodes[id].label || id}'.`,
        signals: [nodes[id].label || String(id)],
      });
      cache[id] = { delay: 0, pred: -1, path: [id], loop: true };
      return cache[id];
    }
    const node = nodes[id];
    const isSeq = SEQ.has(node.type);
    const isIn = node.type === 'IN' || node.type === 'CONST' || node.type === 'NC';

    if (isSeq) {
      // As a source (Q), a DFF launches with Tcq. As a sink we handle separately.
      const launch = { delay: DELAY_MODEL.clkToQ, pred: -1, path: [id], kind: 'reg' };
      cache[id] = launch;
      return launch;
    }
    if (isIn && !fromReg) {
      const launch = { delay: 0, pred: -1, path: [id], kind: 'in' };
      cache[id] = launch;
      return launch;
    }
    if (isIn && fromReg) {
      cache[id] = { delay: -Infinity, pred: -1, path: [id], kind: 'in' };
      return cache[id];
    }

    visiting.add(id);
    let best = { delay: -Infinity, pred: -1, path: [id] };
    const preds = combPred(node);
    if (!preds.length) {
      best = {
        delay: (fromReg ? -Infinity : 0) + nodeDelay(node, fo),
        pred: -1,
        path: [id],
        kind: fromReg ? 'reg' : 'in',
      };
    }
    for (const p of preds) {
      const up = walk(p, fromReg);
      if (!up || up.delay === -Infinity) continue;
      const d = up.delay + nodeDelay(node, fo);
      if (d > best.delay) best = { delay: d, pred: p, path: up.path.concat(id), kind: up.kind };
    }
    visiting.delete(id);
    cache[id] = best;
    return best;
  }

  const groups = {
    inToOut: { delay: -Infinity, path: null },
    inToReg: { delay: -Infinity, path: null },
    regToReg: { delay: -Infinity, path: null },
    regToOut: { delay: -Infinity, path: null },
  };

  const outs = nodes.filter((nd) => nd.type === 'OUT');
  const regs = nodes.filter((nd) => nd.type === 'DFF');

  for (const o of outs) {
    const aIn = walk(o.id, false);
    if (aIn.delay > groups.inToOut.delay) groups.inToOut = { delay: aIn.delay, path: aIn.path, kind: 'in→out' };
    const aReg = walk(o.id, true);
    if (aReg.delay > groups.regToOut.delay) groups.regToOut = { delay: aReg.delay, path: aReg.path, kind: 'reg→out' };
  }
  for (const r of regs) {
    // D-pin is ins[0]
    const dPin = (r.ins && r.ins[0] != null) ? r.ins[0] : null;
    if (dPin == null) continue;
    const aIn = walk(dPin, false);
    const cap = aIn.delay; // setup checked at capture: path delay into D
    if (cap > groups.inToReg.delay) {
      groups.inToReg = { delay: cap, path: (aIn.path || []).concat(r.id), kind: 'in→reg' };
    }
    const aReg = walk(dPin, true);
    if (aReg.delay > groups.regToReg.delay) {
      groups.regToReg = { delay: aReg.delay, path: (aReg.path || []).concat(r.id), kind: 'reg→reg' };
    }
  }

  const finalize = (g, extra) => {
    if (!g.path || g.delay === -Infinity) {
      return { delay: 0, delayNs: 0, nodes: [], stages: [], slack: slackOf(0, extra), empty: true };
    }
    const report = pathReport(nodes, g.path, g.delay);
    report.slack = slackOf(g.delay, extra);
    report.kind = g.kind;
    report.empty = false;
    return report;
  };

  const inToOut = finalize(groups.inToOut, 0);
  const inToReg = finalize(groups.inToReg, DELAY_MODEL.setup);
  const regToReg = finalize(groups.regToReg, DELAY_MODEL.setup);
  const regToOut = finalize(groups.regToOut, 0);

  // Clock frequency is set by the worst register-to-register path (plus Tsu).
  // Pure-comb designs use in→out as the "how slow is this?" number.
  const freqSource = (!regToReg.empty && regs.length)
    ? { group: 'regToReg', delay: regToReg.delay + DELAY_MODEL.setup }
    : { group: 'inToOut', delay: inToOut.delay || 1 };

  const periodNs = Math.max(0.05, freqSource.delay * DELAY_MODEL.unitNs);
  const fmaxMhz = 1000 / periodNs;

  const candidates = [inToOut, inToReg, regToReg, regToOut].filter((g) => !g.empty);
  const critical = candidates.reduce((a, b) => (a.delay >= b.delay ? a : b), inToOut);

  const gateCount = nodes.filter((nd) => !['IN', 'OUT', 'CONST', 'NC', 'NET'].includes(nd.type)).length;
  // Inferred arithmetic is a ripple chain: count width as stages so `a+b`
  // reads as a longer critical path than an explicit lookahead of the same width.
  const stageWeight = (nd) => {
    if (!nd || ['IN', 'OUT', 'CONST', 'DFF'].includes(nd.type)) return 0;
    if (nd.type === 'ADD' || nd.type === 'SUB' || nd.type === 'MUL') {
      return Math.max(1, 2 * (nd.w || 1) - 1);
    }
    return 1;
  };
  const pathDepth = (critical.nodes || []).reduce((s, nd) => s + stageWeight(nd), 0);

  return {
    disclaimer: DELAY_MODEL.disclaimer,
    model: DELAY_MODEL,
    errors,
    groups: { inToOut, inToReg, regToReg, regToOut },
    critical,
    fmaxMhz,
    periodNs,
    freqSource: freqSource.group,
    gateCount,
    pathDepth,
    highlightIds: (critical.nodes || []).map((nd) => nd.id),
  };
}

function analyzeTiming(mod) {
  try {
    const net = netlistOf(mod);
    return analyzeNetlist(net);
  } catch (e) {
    return {
      disclaimer: DELAY_MODEL.disclaimer,
      errors: [{ code: 'TIMING_FAIL', msg: e.message || String(e) }],
      groups: {},
      critical: { delay: 0, nodes: [], stages: [], empty: true },
      fmaxMhz: 0,
      periodNs: 0,
      gateCount: 0,
      pathDepth: 0,
      highlightIds: [],
    };
  }
}

function timingSummaryLine(timing) {
  if (!timing || timing.errors && timing.errors.some((e) => e.code === 'COMB_LOOP')) {
    const err = timing && timing.errors && timing.errors[0];
    return err ? `timing: ${err.msg}` : 'timing: unavailable';
  }
  const depth = timing.pathDepth || 0;
  const mhz = timing.fmaxMhz ? Math.round(timing.fmaxMhz) : 0;
  return `critical path: ${depth} gates · ~${mhz} MHz`;
}

function combatTimingMult(gateCount, pathDepth) {
  const g = Math.max(1, gateCount || 1);
  const p = Math.max(1, pathDepth || 1);
  const gateMult = Math.min(2.2, 14 / g);
  const pathMult = Math.min(2.2, 8 / p);
  return {
    gateCount: g,
    pathDepth: p,
    gateMult,
    pathMult,
    total: gateMult * pathMult,
  };
}

export { analyzeTiming, analyzeNetlist, timingSummaryLine, combatTimingMult, nodeDelay, baseDelay };
