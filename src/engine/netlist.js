// ============================================================
// NETLIST EXTRACTION — gate-level DAG for the schematic view
// ============================================================

import { walkExprNames, walkStmt, lvalueNames } from './core.js';
import { formatValue } from './format.js';

// ============================================================
// DEBUG BAY CORE — netlist extraction, mux transform, error help (pure)
// ============================================================
// Turns a compiled module into a gate-level DAG for the hardware view.
// Procedural always-blocks are converted to mux trees (the synthesis view):
// `if` becomes a mux, `case` a mux chain, and an uncovered path in a
// combinational block becomes a VISIBLE latch with a feedback edge.
const NL_HOLD = { kind: 'hold' };

function nlAssignedTargets(stmt) {
  const out = new Set();
  walkStmt(stmt, { assign: (s) => lvalueNames(s.lhs).forEach(n => out.add(n.name)) });
  return [...out];
}
function nlReadSignals(stmt) {
  const out = new Set();
  walkStmt(stmt, { expr: (e) => walkExprNames(e, (n) => out.add(n)) });
  return [...out];
}
function nlContainsHold(e) {
  if (!e || typeof e !== 'object') return false;
  if (e.kind === 'hold') return true;
  switch (e.kind) {
    case 'un': return nlContainsHold(e.e);
    case 'bin': return nlContainsHold(e.l) || nlContainsHold(e.r);
    case 'tern': return nlContainsHold(e.c) || nlContainsHold(e.t) || nlContainsHold(e.f);
    case 'concat': return e.parts.some(nlContainsHold);
    case 'repl': return nlContainsHold(e.countE) || nlContainsHold(e.e);
    default: return false;
  }
}
// Fold a statement tree into a single expression for `target`'s next value.
function muxifyStmt(stmt, target, cur) {
  if (!stmt) return cur;
  switch (stmt.kind) {
    case 'empty': return cur;
    case 'block': {
      let c = cur;
      for (const s of stmt.stmts) { c = muxifyStmt(s, target, c); if (c && c.kind === 'procfail') return c; }
      return c;
    }
    case 'assign': {
      if (!lvalueNames(stmt.lhs).some(n => n.name === target)) return cur;
      if (stmt.lhs.kind === 'sig') return stmt.expr;
      return { kind: 'procfail' };
    }
    case 'if': {
      const t = muxifyStmt(stmt.then, target, cur);
      const f = muxifyStmt(stmt.els, target, cur);
      if (t.kind === 'procfail' || f.kind === 'procfail') return { kind: 'procfail' };
      if (t === cur && f === cur) return cur;
      return { kind: 'tern', c: stmt.cond, t, f, line: stmt.line };
    }
    case 'case': {
      let acc = stmt.def ? muxifyStmt(stmt.def, target, cur) : cur;
      if (acc.kind === 'procfail') return acc;
      for (let i = stmt.items.length - 1; i >= 0; i--) {
        const it = stmt.items[i];
        const body = muxifyStmt(it.body, target, cur);
        if (body.kind === 'procfail') return body;
        let cond = null;
        for (const lb of it.labels) {
          const eq = { kind: 'bin', op: '==', l: stmt.subj, r: lb, line: stmt.line };
          cond = cond ? { kind: 'bin', op: '||', l: cond, r: eq, line: stmt.line } : eq;
        }
        if (body === acc || !cond) continue;
        acc = { kind: 'tern', c: cond, t: body, f: acc, line: stmt.line };
      }
      return acc;
    }
    default: return { kind: 'procfail' };
  }
}

const NL_BIN = { '&': 'AND', '|': 'OR', '^': 'XOR', '~^': 'XNOR', '&&': 'AND', '||': 'OR', '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV', '%': 'MOD', '<<': 'SHL', '>>': 'SHR' };

function netlistOf(mod) {
  const nodes = [], memo = new Map(), visiting = new Set(), latched = [];
  const sigW = (n) => { const s = mod.signals.get(n); return (s && s.width) || 1; };
  const add = (o) => { o.id = nodes.length; o.ins = o.ins || []; o.fbIns = o.fbIns || []; nodes.push(o); return o.id; };

  // drivers: name -> { a?: assignExpr, ff?: {dExpr, clk}, comb?: {expr, latch}, cat?: {expr, off, w} }
  const drivers = new Map();
  for (const a of mod.assigns) {
    if (a.lhs.kind === 'sig') drivers.set(a.lhs.name, { a: a.expr });
    else if (a.lhs.kind === 'concat') {
      const parts = a.lhs.parts.map(p => (p.kind === 'sig' ? p.name : null));
      if (parts.every(Boolean)) {
        const ws = parts.map(sigW);
        let off = ws.reduce((s, w) => s + w, 0);
        const shared = { expr: a.expr, srcId: null };
        parts.forEach((nm, i) => { off -= ws[i]; drivers.set(nm, { cat: { shared, off, w: ws[i] } }); });
      } else parts.forEach(nm => nm && drivers.set(nm, { proc: a }));
    } else if (a.lhs.name) drivers.set(a.lhs.name, { proc: a });
  }
  for (const b of mod.blocks) {
    for (const t of nlAssignedTargets(b.stmt)) {
      if (b.kind === 'clocked') drivers.set(t, { ff: { dExpr: muxifyStmt(b.stmt, t, NL_HOLD), clk: (b.edges && b.edges[0]) || 'clk', stmt: b.stmt } });
      else {
        const e = muxifyStmt(b.stmt, t, NL_HOLD);
        drivers.set(t, { comb: { expr: e, latch: e.kind !== 'procfail' && nlContainsHold(e), stmt: b.stmt } });
      }
    }
  }

  const procNode = (name, stmt) => add({ type: 'PROC', label: name + ' logic', w: sigW(name), ins: nlReadSignals(stmt || { kind: 'empty' }).filter(n => n !== name).map(n => resolve(n)) });

  function exprNode(e, holdId) {
    switch (e.kind) {
      case 'hold': return holdId;
      case 'num': return add({ type: 'CONST', label: formatValue(e, e.w || 1), w: e.w || 1 });
      case 'sig': return resolve(e.name);
      case 'bit': return add({ type: 'SLICE', label: '[' + (e.idxE && e.idxE.kind === 'num' ? e.idxE.v : '·') + ']', w: 1, ins: [exprNode({ kind: 'sig', name: e.name, line: e.line }, holdId)] });
      case 'part': {
        const m = e.msbE && e.msbE.kind === 'num' ? e.msbE.v : '·', l = e.lsbE && e.lsbE.kind === 'num' ? e.lsbE.v : '·';
        return add({ type: 'SLICE', label: '[' + m + ':' + l + ']', w: (typeof m === 'number' && typeof l === 'number') ? m - l + 1 : 1, ins: [exprNode({ kind: 'sig', name: e.name, line: e.line }, holdId)] });
      }
      case 'concat': { const ins = e.parts.map(p => exprNode(p, holdId)); return add({ type: 'CAT', label: '{…}', w: ins.reduce((s, id) => s + (nodes[id].w || 1), 0), ins }); }
      case 'repl': return add({ type: 'REPL', label: '{n{·}}', w: 1, ins: [exprNode(e.e, holdId)] });
      case 'un': {
        const a = exprNode(e.e, holdId);
        if (e.op === '~') return add({ type: 'NOT', label: '~', w: nodes[a].w, ins: [a] });
        if (e.op === '!') return add({ type: 'NOT', label: '!', w: 1, ins: [a] });
        if (e.op === '-') return add({ type: 'NEG', label: '−', w: nodes[a].w, ins: [a] });
        return add({ type: 'RED', label: e.op, w: 1, ins: [a] });
      }
      case 'bin': {
        const a = exprNode(e.l, holdId), b = exprNode(e.r, holdId);
        const t = NL_BIN[e.op];
        if (t) return add({ type: t, label: e.op, w: Math.max(nodes[a].w || 1, nodes[b].w || 1) + (t === 'ADD' || t === 'SUB' ? 1 : 0), ins: [a, b] });
        return add({ type: 'CMP', label: e.op, w: 1, ins: [a, b] });
      }
      case 'tern': {
        const c = exprNode(e.c, holdId), t = exprNode(e.t, holdId), f = exprNode(e.f, holdId);
        return add({ type: 'MUX', label: '', w: Math.max(nodes[t].w || 1, nodes[f].w || 1), ins: [t, f, c] });
      }
      default: return add({ type: 'NC', label: '?', w: 1 });
    }
  }

  function resolve(name) {
    if (memo.has(name)) return memo.get(name);
    const si = mod.signals.get(name);
    if (si && si.dir === 'input') { const id = add({ type: 'IN', label: name, w: sigW(name) }); memo.set(name, id); return id; }
    const d = drivers.get(name);
    if (!d) { const id = add({ type: 'NC', label: name, w: sigW(name) }); memo.set(name, id); return id; }
    if (visiting.has(name)) { const id = add({ type: 'NET', label: name, w: sigW(name), fbFor: name }); return id; }
    visiting.add(name);
    let id;
    if (d.ff) {
      id = add({ type: 'DFF', label: name, w: sigW(name), clk: d.ff.clk, ins: [null], fbIns: [0] });
      memo.set(name, id);
      const dE = d.ff.dExpr.kind === 'procfail' ? procNode(name, d.ff.stmt) : exprNode(d.ff.dExpr, id);
      nodes[id].ins[0] = dE;
    } else if (d.comb) {
      if (d.comb.latch) {
        id = add({ type: 'LATCH', label: name, w: sigW(name), ins: [null], fbIns: [0] });
        memo.set(name, id);
        latched.push(name);
        nodes[id].ins[0] = exprNode(d.comb.expr, id);
      } else {
        id = d.comb.expr.kind === 'procfail' ? procNode(name, d.comb.stmt) : exprNode(d.comb.expr, -1);
        memo.set(name, id);
      }
    } else if (d.cat) {
      if (d.cat.shared.srcId == null) d.cat.shared.srcId = exprNode(d.cat.shared.expr, -1);
      id = add({ type: 'SLICE', label: '[' + (d.cat.off + d.cat.w - 1) + ':' + d.cat.off + ']', w: d.cat.w, ins: [d.cat.shared.srcId] });
      memo.set(name, id);
    } else if (d.proc) {
      id = procNode(name, d.proc.stmt || { kind: 'empty' });
      memo.set(name, id);
    } else {
      id = exprNode(d.a, -1);
      memo.set(name, id);
    }
    visiting.delete(name);
    return id;
  }

  const outputs = [];
  for (const [name, si] of mod.signals) {
    if (si.dir === 'output') outputs.push(name);
  }
  outputs.forEach(name => add({ type: 'OUT', label: name, w: sigW(name), ins: [resolve(name)] }));
  // wire feedback placeholder nets to their real drivers
  nodes.forEach(n => { if (n.type === 'NET' && n.fbFor != null && memo.has(n.fbFor)) { n.ins = [memo.get(n.fbFor)]; n.fbIns = [0]; } });
  return { nodes, latched, outputs };
}

const NL_SIZE = { IN: [64, 22], OUT: [64, 22], CONST: [44, 18], DFF: [58, 46], LATCH: [58, 40], MUX: [34, 50], NOT: [36, 26], NEG: [36, 26], RED: [40, 26], AND: [46, 32], OR: [46, 32], XOR: [48, 32], XNOR: [48, 32], ADD: [34, 34], SUB: [34, 34], MUL: [34, 34], DIV: [40, 28], MOD: [40, 28], SHL: [42, 26], SHR: [42, 26], CMP: [44, 28], SLICE: [46, 22], CAT: [40, 26], REPL: [44, 22], PROC: [76, 40], NET: [50, 22], NC: [44, 20] };

function levelizeNetlist(net) {
  const nodes = net.nodes.map(n => ({ ...n }));
  const n = nodes.length;
  const lvl = new Array(n).fill(-1);
  const busy = new Set();
  const rank0 = (t) => t === 'IN' || t === 'CONST' || t === 'DFF' || t === 'LATCH' || t === 'NET' || t === 'NC';
  const level = (i) => {
    if (lvl[i] >= 0) return lvl[i];
    if (busy.has(i)) return 0;
    busy.add(i);
    let v = 0;
    if (!rank0(nodes[i].type)) {
      let mx = -1;
      nodes[i].ins.forEach((p, k) => { if (p != null && !nodes[i].fbIns.includes(k)) mx = Math.max(mx, level(p)); });
      v = mx + 1;
    }
    busy.delete(i);
    lvl[i] = v;
    return v;
  };
  for (let i = 0; i < n; i++) level(i);
  let maxL = 0; for (let i = 0; i < n; i++) if (nodes[i].type !== 'OUT') maxL = Math.max(maxL, lvl[i]);
  for (let i = 0; i < n; i++) if (nodes[i].type === 'OUT') lvl[i] = maxL + 1;
  const cols = [];
  for (let i = 0; i < n; i++) { (cols[lvl[i]] = cols[lvl[i]] || []).push(i); }
  // two barycenter passes for tidier wires
  for (let pass = 0; pass < 2; pass++) {
    const pos = new Array(n).fill(0);
    cols.forEach(c => c && c.forEach((id, k) => { pos[id] = k; }));
    cols.forEach((c, L) => {
      if (!c || L === 0) return;
      c.sort((a, b) => {
        const bc = (id) => { const ps = nodes[id].ins.filter(p => p != null); return ps.length ? ps.reduce((s, p) => s + pos[p], 0) / ps.length : pos[id]; };
        return bc(a) - bc(b);
      });
    });
  }
  const GX = 52, GY = 20, M = 26;
  let x = M;
  const colX = [], colW = [];
  cols.forEach((c, L) => {
    const w = c && c.length ? Math.max(...c.map(id => (NL_SIZE[nodes[id].type] || [50, 28])[0])) : 0;
    colX[L] = x; colW[L] = w; x += w + GX;
  });
  const W = x - GX + M;
  let H = 0;
  cols.forEach(c => { if (!c) return; const h = c.reduce((s, id) => s + (NL_SIZE[nodes[id].type] || [50, 28])[1] + GY, 0); H = Math.max(H, h); });
  H += M * 2;
  cols.forEach((c, L) => {
    if (!c) return;
    const tot = c.reduce((s, id) => s + (NL_SIZE[nodes[id].type] || [50, 28])[1] + GY, 0) - GY;
    let y = (H - tot) / 2;
    c.forEach(id => {
      const [w, h] = NL_SIZE[nodes[id].type] || [50, 28];
      nodes[id].x = colX[L]; nodes[id].y = y; nodes[id].wd = w; nodes[id].ht = h; nodes[id].lvl = lvl[id];
      y += h + GY;
    });
  });
  const edges = [];
  nodes.forEach(nd => nd.ins.forEach((p, k) => { if (p != null) edges.push({ from: p, to: nd.id, pin: k, fb: nd.fbIns.includes(k) }); }));
  return { nodes, edges, W: Math.max(W, 200), H: Math.max(H, 120), latched: net.latched };
}

export { netlistOf, levelizeNetlist, NL_SIZE, NL_BIN, NL_HOLD };
