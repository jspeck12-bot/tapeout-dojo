// ============================================================
// DEBUG BAY NETLIST — synthesis view + deterministic layout
// ============================================================
import { formatValue } from '../format.js';
import { lvalueNames, walkExprNames, walkStmt } from '../verilog.js';

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
      for (const s of stmt.stmts) {
        c = muxifyStmt(s, target, c);
        if (c && c.kind === 'procfail') return c;
      }
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
        for (const label of it.labels) {
          const eq = { kind: 'bin', op: '==', l: stmt.subj, r: label, line: stmt.line };
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

const NL_BIN = {
  '&': 'AND', '|': 'OR', '^': 'XOR', '~^': 'XNOR',
  '&&': 'AND', '||': 'OR', '+': 'ADD', '-': 'SUB',
  '*': 'MUL', '/': 'DIV', '%': 'MOD', '<<': 'SHL', '>>': 'SHR',
};

function netlistOf(mod) {
  const nodes = [], memo = new Map(), visiting = new Set(), latched = [];
  const sigW = (name) => {
    const signal = mod.signals.get(name);
    return (signal && signal.width) || 1;
  };
  const add = (node) => {
    node.id = nodes.length;
    node.ins = node.ins || [];
    node.fbIns = node.fbIns || [];
    nodes.push(node);
    return node.id;
  };

  const drivers = new Map();
  for (const assign of mod.assigns) {
    if (assign.lhs.kind === 'sig') drivers.set(assign.lhs.name, { a: assign.expr });
    else if (assign.lhs.kind === 'concat') {
      const parts = assign.lhs.parts.map(part => (part.kind === 'sig' ? part.name : null));
      if (parts.every(Boolean)) {
        const widths = parts.map(sigW);
        let offset = widths.reduce((sum, width) => sum + width, 0);
        const shared = { expr: assign.expr, srcId: null };
        parts.forEach((name, index) => {
          offset -= widths[index];
          drivers.set(name, { cat: { shared, off: offset, w: widths[index] } });
        });
      } else {
        parts.forEach(name => name && drivers.set(name, { proc: assign }));
      }
    } else if (assign.lhs.name) {
      drivers.set(assign.lhs.name, { proc: assign });
    }
  }

  for (const block of mod.blocks) {
    for (const target of nlAssignedTargets(block.stmt)) {
      if (block.kind === 'clocked') {
        drivers.set(target, {
          ff: {
            dExpr: muxifyStmt(block.stmt, target, NL_HOLD),
            clk: (block.edges && block.edges[0]) || 'clk',
            stmt: block.stmt,
          },
        });
      } else {
        const expr = muxifyStmt(block.stmt, target, NL_HOLD);
        drivers.set(target, {
          comb: {
            expr,
            latch: expr.kind !== 'procfail' && nlContainsHold(expr),
            stmt: block.stmt,
          },
        });
      }
    }
  }

  const procNode = (name, stmt) => add({
    type: 'PROC',
    label: name + ' logic',
    w: sigW(name),
    ins: nlReadSignals(stmt || { kind: 'empty' })
      .filter(signal => signal !== name)
      .map(signal => resolve(signal)),
  });

  function exprNode(expr, holdId) {
    switch (expr.kind) {
      case 'hold': return holdId;
      case 'num': return add({ type: 'CONST', label: formatValue(expr.v, expr.w || 1), w: expr.w || 1 });
      case 'sig': {
        if (mod.params.has(expr.name)) {
          const parameter = mod.params.get(expr.name);
          const value = parameter && typeof parameter === 'object'
            ? parameter
            : { v: parameter, w: 32 };
          return add({ type: 'CONST', label: formatValue(value.v, value.w), w: value.w });
        }
        return resolve(expr.name);
      }
      case 'bit':
        return add({
          type: 'SLICE',
          label: '[' + (expr.idxE && expr.idxE.kind === 'num' ? expr.idxE.v : '·') + ']',
          w: 1,
          ins: [exprNode({ kind: 'sig', name: expr.name, line: expr.line }, holdId)],
        });
      case 'part': {
        const msb = expr.msbE && expr.msbE.kind === 'num' ? expr.msbE.v : '·';
        const lsb = expr.lsbE && expr.lsbE.kind === 'num' ? expr.lsbE.v : '·';
        return add({
          type: 'SLICE',
          label: '[' + msb + ':' + lsb + ']',
          w: (typeof msb === 'number' && typeof lsb === 'number') ? msb - lsb + 1 : 1,
          ins: [exprNode({ kind: 'sig', name: expr.name, line: expr.line }, holdId)],
        });
      }
      case 'concat': {
        const ins = expr.parts.map(part => exprNode(part, holdId));
        return add({
          type: 'CAT',
          label: '{…}',
          w: ins.reduce((sum, id) => sum + (nodes[id].w || 1), 0),
          ins,
        });
      }
      case 'repl':
        return add({ type: 'REPL', label: '{n{·}}', w: 1, ins: [exprNode(expr.e, holdId)] });
      case 'un': {
        const input = exprNode(expr.e, holdId);
        if (expr.op === '~') return add({ type: 'NOT', label: '~', w: nodes[input].w, ins: [input] });
        if (expr.op === '!') return add({ type: 'NOT', label: '!', w: 1, ins: [input] });
        if (expr.op === '-') return add({ type: 'NEG', label: '−', w: nodes[input].w, ins: [input] });
        return add({ type: 'RED', label: expr.op, w: 1, ins: [input] });
      }
      case 'bin': {
        const left = exprNode(expr.l, holdId);
        const right = exprNode(expr.r, holdId);
        const type = NL_BIN[expr.op];
        if (type) {
          return add({
            type,
            label: expr.op,
            w: Math.max(nodes[left].w || 1, nodes[right].w || 1) +
              (type === 'ADD' || type === 'SUB' ? 1 : 0),
            ins: [left, right],
          });
        }
        return add({ type: 'CMP', label: expr.op, w: 1, ins: [left, right] });
      }
      case 'tern': {
        const condition = exprNode(expr.c, holdId);
        const yes = exprNode(expr.t, holdId);
        const no = exprNode(expr.f, holdId);
        return add({
          type: 'MUX',
          label: '',
          w: Math.max(nodes[yes].w || 1, nodes[no].w || 1),
          ins: [yes, no, condition],
        });
      }
      default:
        return add({ type: 'NC', label: '?', w: 1 });
    }
  }

  function resolve(name) {
    if (memo.has(name)) return memo.get(name);
    const signal = mod.signals.get(name);
    if (signal && signal.dir === 'input') {
      const id = add({ type: 'IN', label: name, w: sigW(name) });
      memo.set(name, id);
      return id;
    }
    const driver = drivers.get(name);
    if (!driver) {
      const id = add({ type: 'NC', label: name, w: sigW(name) });
      memo.set(name, id);
      return id;
    }
    if (visiting.has(name)) return add({ type: 'NET', label: name, w: sigW(name), fbFor: name });

    visiting.add(name);
    let id;
    if (driver.ff) {
      id = add({ type: 'DFF', label: name, w: sigW(name), clk: driver.ff.clk, ins: [null], fbIns: [0] });
      memo.set(name, id);
      const dExpr = driver.ff.dExpr.kind === 'procfail'
        ? procNode(name, driver.ff.stmt)
        : exprNode(driver.ff.dExpr, id);
      nodes[id].ins[0] = dExpr;
    } else if (driver.comb) {
      if (driver.comb.latch) {
        id = add({ type: 'LATCH', label: name, w: sigW(name), ins: [null], fbIns: [0] });
        memo.set(name, id);
        latched.push(name);
        nodes[id].ins[0] = exprNode(driver.comb.expr, id);
      } else {
        id = driver.comb.expr.kind === 'procfail'
          ? procNode(name, driver.comb.stmt)
          : exprNode(driver.comb.expr, -1);
        memo.set(name, id);
      }
    } else if (driver.cat) {
      if (driver.cat.shared.srcId == null) driver.cat.shared.srcId = exprNode(driver.cat.shared.expr, -1);
      id = add({
        type: 'SLICE',
        label: '[' + (driver.cat.off + driver.cat.w - 1) + ':' + driver.cat.off + ']',
        w: driver.cat.w,
        ins: [driver.cat.shared.srcId],
      });
      memo.set(name, id);
    } else if (driver.proc) {
      id = procNode(name, driver.proc.stmt || { kind: 'empty' });
      memo.set(name, id);
    } else {
      id = exprNode(driver.a, -1);
      memo.set(name, id);
    }
    visiting.delete(name);
    return id;
  }

  const outputs = [];
  for (const [name, signal] of mod.signals) {
    if (signal.dir === 'output') outputs.push(name);
  }
  outputs.forEach(name => add({ type: 'OUT', label: name, w: sigW(name), ins: [resolve(name)] }));
  nodes.forEach(node => {
    if (node.type === 'NET' && node.fbFor != null && memo.has(node.fbFor)) {
      node.ins = [memo.get(node.fbFor)];
      node.fbIns = [0];
    }
  });
  return { nodes, latched, outputs };
}

const NL_SIZE = {
  IN: [64, 22], OUT: [64, 22], CONST: [44, 18], DFF: [58, 46],
  LATCH: [58, 40], MUX: [34, 50], NOT: [36, 26], NEG: [36, 26],
  RED: [40, 26], AND: [46, 32], OR: [46, 32], XOR: [48, 32],
  XNOR: [48, 32], ADD: [34, 34], SUB: [34, 34], MUL: [34, 34],
  DIV: [40, 28], MOD: [40, 28], SHL: [42, 26], SHR: [42, 26],
  CMP: [44, 28], SLICE: [46, 22], CAT: [40, 26], REPL: [44, 22],
  PROC: [76, 40], NET: [50, 22], NC: [44, 20],
};

function levelizeNetlist(net) {
  const nodes = net.nodes.map(node => ({ ...node }));
  const count = nodes.length;
  const levels = new Array(count).fill(-1);
  const busy = new Set();
  const rankZero = (type) =>
    type === 'IN' || type === 'CONST' || type === 'DFF' ||
    type === 'LATCH' || type === 'NET' || type === 'NC';

  const level = (index) => {
    if (levels[index] >= 0) return levels[index];
    if (busy.has(index)) return 0;
    busy.add(index);
    let value = 0;
    if (!rankZero(nodes[index].type)) {
      let maximum = -1;
      nodes[index].ins.forEach((parent, pin) => {
        if (parent != null && !nodes[index].fbIns.includes(pin)) {
          maximum = Math.max(maximum, level(parent));
        }
      });
      value = maximum + 1;
    }
    busy.delete(index);
    levels[index] = value;
    return value;
  };

  for (let index = 0; index < count; index++) level(index);
  let maxLevel = 0;
  for (let index = 0; index < count; index++) {
    if (nodes[index].type !== 'OUT') maxLevel = Math.max(maxLevel, levels[index]);
  }
  for (let index = 0; index < count; index++) {
    if (nodes[index].type === 'OUT') levels[index] = maxLevel + 1;
  }

  const columns = [];
  for (let index = 0; index < count; index++) {
    (columns[levels[index]] = columns[levels[index]] || []).push(index);
  }
  for (let pass = 0; pass < 2; pass++) {
    const positions = new Array(count).fill(0);
    columns.forEach(column => column && column.forEach((id, index) => { positions[id] = index; }));
    columns.forEach((column, columnIndex) => {
      if (!column || columnIndex === 0) return;
      column.sort((left, right) => {
        const barycenter = (id) => {
          const parents = nodes[id].ins.filter(parent => parent != null);
          return parents.length
            ? parents.reduce((sum, parent) => sum + positions[parent], 0) / parents.length
            : positions[id];
        };
        return barycenter(left) - barycenter(right);
      });
    });
  }

  const gapX = 52, gapY = 20, margin = 26;
  let x = margin;
  const columnX = [];
  columns.forEach((column, columnIndex) => {
    const width = column && column.length
      ? Math.max(...column.map(id => (NL_SIZE[nodes[id].type] || [50, 28])[0]))
      : 0;
    columnX[columnIndex] = x;
    x += width + gapX;
  });
  const width = x - gapX + margin;
  let height = 0;
  columns.forEach(column => {
    if (!column) return;
    const columnHeight = column.reduce(
      (sum, id) => sum + (NL_SIZE[nodes[id].type] || [50, 28])[1] + gapY,
      0,
    );
    height = Math.max(height, columnHeight);
  });
  height += margin * 2;
  columns.forEach((column, columnIndex) => {
    if (!column) return;
    const total = column.reduce(
      (sum, id) => sum + (NL_SIZE[nodes[id].type] || [50, 28])[1] + gapY,
      0,
    ) - gapY;
    let y = (height - total) / 2;
    column.forEach(id => {
      const [nodeWidth, nodeHeight] = NL_SIZE[nodes[id].type] || [50, 28];
      nodes[id].x = columnX[columnIndex];
      nodes[id].y = y;
      nodes[id].wd = nodeWidth;
      nodes[id].ht = nodeHeight;
      nodes[id].lvl = levels[id];
      y += nodeHeight + gapY;
    });
  });
  const edges = [];
  nodes.forEach(node => node.ins.forEach((parent, pin) => {
    if (parent != null) {
      edges.push({ from: parent, to: node.id, pin, fb: node.fbIns.includes(pin) });
    }
  }));
  return {
    nodes,
    edges,
    W: Math.max(width, 200),
    H: Math.max(height, 120),
    latched: net.latched,
  };
}

export {
  NL_BIN,
  NL_SIZE,
  levelizeNetlist,
  muxifyStmt,
  netlistOf,
};
