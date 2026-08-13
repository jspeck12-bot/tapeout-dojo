// ============================================================
// VERILOG ENGINE CORE — lexer, parser, elaborator, simulator
// Pure synchronous module: no DOM, no React, no three.js, no Worker.
// Importable from Node (the gate) and from the Worker wrapper.
// ============================================================

import { formatValue } from './format.js';
import {
  asLogic, logic01, logicX, logicZ, logicSame, logicNot, logicAnd, logicOr, logicXor, logicXnor,
  reduction, logicEq, logicNeq, logicEqCase, logicNeqCase, logicArith, logicShiftLeft, logicShiftRight,
  logicTern, logicLogNot, logicLogAnd, logicLogOr, logicCmpRel, concatLogic, sliceLogic,
  bitSet, partSet, resolveDrivers, parseLiteralDigits, bitAt, logicWiden, valuesEqual as valuesEqualLogic,
} from './values.js';

const V_KEYWORDS = new Set([
  'module','endmodule','input','output','inout','wire','reg','assign','always',
  'begin','end','if','else','case','casez','casex','endcase','default',
  'posedge','negedge','parameter','localparam','integer','initial','signed',
  'or','and','not','nand','nor','xor','xnor','buf','generate','endgenerate',
  'for','while','repeat','forever','function','endfunction','task','endtask','genvar'
]);

function vErr(line, msg, hint) {
  const e = new Error(msg);
  e.line = line; e.hint = hint || null; e.isVerilogError = true;
  return e;
}

function pow2(w) { return Math.pow(2, w); }
function maskW(v, w) { const m = pow2(w); return ((v % m) + m) % m; }

// Simulation step budget — combinational loops are a student bug, not a hang.
const SIM_MAX_DELTA = 256;
const SIM_MAX_EVENTS = 100000;

// ---------------- Tokenizer ----------------
function vTokenize(src) {
  const toks = [];
  let i = 0, line = 1;
  const push = (t, v) => toks.push({ t, v, line });
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
      if (i >= n) throw vErr(line, "Unclosed /* block comment.");
      i += 2; continue;
    }
    if (c >= '0' && c <= '9') {
      let j = i;
      while (j < n && /[0-9_]/.test(src[j])) j++;
      if (src[j] === "'") {
        const width = parseInt(src.slice(i, j).replace(/_/g, ''), 10);
        let k = j + 1;
        let signed = false;
        if (src[k] === 's' || src[k] === 'S') { signed = true; k++; }
        const base = (src[k] || '').toLowerCase();
        if (!'bdho'.includes(base)) throw vErr(line, `Bad literal base '${src[k] || ''}' — use b (binary), h (hex), d (decimal), or o (octal). Example: 4'b1010`);
        k++;
        let digits = '';
        while (k < n && /[0-9a-fA-FxXzZ_?]/.test(src[k])) { digits += src[k]; k++; }
        push('num', { width, base, digits, signed }); i = k; continue;
      } else {
        push('num', { width: 32, base: 'd', digits: src.slice(i, j), bare: true });
        i = j; continue;
      }
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < n && /[a-zA-Z0-9_$]/.test(src[j])) j++;
      const w = src.slice(i, j);
      push(V_KEYWORDS.has(w) ? 'kw' : 'id', w);
      i = j; continue;
    }
    const three = src.substr(i, 3);
    if (three === '===' || three === '!==') { push('op', three); i += 3; continue; }
    const two = src.substr(i, 2);
    if (['<=', '>=', '==', '!=', '&&', '||', '<<', '>>', '~&', '~|', '~^', '^~', '**'].includes(two)) {
      push('op', two === '^~' ? '~^' : two); i += 2; continue;
    }
    if ('()[]{},;:?=+-*/%~!&|^<>@#.'.includes(c)) { push('op', c); i++; continue; }
    throw vErr(line, `Unexpected character '${c}'.`);
  }
  push('eof', '', line);
  return toks;
}

function litValue(tok) {
  const { width, base, digits } = tok.v;
  let w = tok.v.bare ? 32 : width;
  if (!tok.v.bare && !(w >= 1 && w <= 32)) throw vErr(tok.line, `Literal width must be 1–32 bits (got ${width}).`);
  const parsed = parseLiteralDigits(w, base, digits);
  if (parsed.error) throw vErr(tok.line, parsed.error);
  return parsed.logic;
}

// ---------------- Parser ----------------
class VParser {
  constructor(toks) { this.toks = toks; this.p = 0; }
  peek(k = 0) { return this.toks[Math.min(this.p + k, this.toks.length - 1)]; }
  next() { return this.toks[this.p++]; }
  at(t, v) { const tk = this.peek(); return tk.t === t && (v === undefined || tk.v === v); }
  atOp(v) { return this.at('op', v); }
  atKw(v) { return this.at('kw', v); }
  eatOp(v, what) {
    if (!this.atOp(v)) {
      const tk = this.peek();
      throw vErr(tk.line, `Expected '${v}'${what ? ' ' + what : ''}, found ${this.describe(tk)}.`,
        v === ';' ? "Every assign, declaration, and statement ends with a semicolon." : null);
    }
    return this.next();
  }
  eatKw(v) {
    if (!this.atKw(v)) {
      const tk = this.peek();
      throw vErr(tk.line, `Expected keyword '${v}', found ${this.describe(tk)}.`);
    }
    return this.next();
  }
  eatId(what) {
    if (!this.at('id')) {
      const tk = this.peek();
      if (tk.t === 'kw') throw vErr(tk.line, `'${tk.v}' is a Verilog keyword — it can't be used as ${what || 'a name'}.`);
      throw vErr(tk.line, `Expected ${what || 'an identifier'}, found ${this.describe(tk)}.`);
    }
    return this.next();
  }
  describe(tk) {
    if (tk.t === 'eof') return 'end of file';
    if (tk.t === 'num') return `number '${tk.v.bare ? tk.v.digits : tk.v.width + "'" + tk.v.base + tk.v.digits}'`;
    return `'${tk.v}'`;
  }

  parseModule() {
    while (this.atOp(';')) this.next();
    if (this.at('eof')) throw vErr(1, "No module found.", "Start with: module my_module(input a, output y);");
    if (!this.atKw('module')) {
      const tk = this.peek();
      throw vErr(tk.line, `Expected 'module' at the top, found ${this.describe(tk)}.`,
        "Everything in Verilog lives inside module ... endmodule.");
    }
    this.next();
    const nameTok = this.eatId('the module name');
    const mod = {
      name: nameTok.v, line: nameTok.line,
      ports: [], signals: new Map(), params: new Map(),
      assigns: [], blocks: [], warnings: []
    };
    const declare = (name, info, line) => {
      if (mod.signals.has(name)) {
        const old = mod.signals.get(name);
        // Allow upgrading a classic-style port (dir known, body adds reg/width) once
        if (old.portOnly && !info.portOnly) {
          if (info.dir && old.dir && info.dir !== old.dir) throw vErr(line, `'${name}' is declared both ${old.dir} and ${info.dir}.`);
          mod.signals.set(name, { ...old, ...info, portOnly: false });
          return;
        }
        throw vErr(line, `'${name}' is declared more than once.`);
      }
      if (V_KEYWORDS.has(name)) throw vErr(line, `'${name}' is a keyword.`);
      mod.signals.set(name, info);
    };

    // ---- port list ----
    this.eatOp('(', 'after the module name');
    let lastDir = null, lastKind = 'wire', lastRange = null;
    if (!this.atOp(')')) {
      while (true) {
        let dir = null, kind = null, range = null;
        if (this.atKw('input') || this.atKw('output') || this.atKw('inout')) {
          dir = this.next().v;
          if (dir === 'inout') throw vErr(this.peek().line, "inout ports aren't supported in the Dojo.");
          kind = 'wire';
          if (this.atKw('reg')) { kind = 'reg'; this.next(); }
          else if (this.atKw('wire')) this.next();
          if (this.atKw('signed')) throw vErr(this.peek().line, "'signed' isn't supported — the Dojo is unsigned. Handle sign bits manually (that's the fun part).");
          if (this.atOp('[')) range = this.parseRange(mod);
          lastDir = dir; lastKind = kind; lastRange = range;
        } else if (this.at('id') && lastDir) {
          dir = lastDir; kind = lastKind; range = lastRange;
        } else if (this.at('id')) {
          // classic style: bare names, declared in body
          const nm = this.next();
          mod.ports.push({ name: nm.v, dir: null, line: nm.line });
          declare(nm.v, { kind: 'wire', width: 1, dir: null, isPort: true, portOnly: true, line: nm.line }, nm.line);
          if (this.atOp(',')) { this.next(); continue; }
          break;
        } else {
          const tk = this.peek();
          throw vErr(tk.line, `Bad port list: found ${this.describe(tk)}.`, "Example: module m(input a, input [3:0] b, output y);");
        }
        const nm = this.eatId('a port name');
        const width = range ? range.width : 1;
        mod.ports.push({ name: nm.v, dir, line: nm.line });
        declare(nm.v, { kind: dir === 'output' && kind === 'reg' ? 'reg' : 'wire', width, dir, isPort: true, line: nm.line }, nm.line);
        if (dir === 'input' && kind === 'reg') throw vErr(nm.line, `Input '${nm.v}' can't be a reg — inputs are driven from outside.`);
        if (this.atOp(',')) { this.next(); continue; }
        break;
      }
    }
    this.eatOp(')', 'to close the port list');
    this.eatOp(';', 'after the port list');

    // ---- body ----
    while (!this.atKw('endmodule')) {
      const tk = this.peek();
      if (tk.t === 'eof') throw vErr(tk.line, "Reached end of file — missing 'endmodule'.");
      if (this.atKw('input') || this.atKw('output')) {
        const dir = this.next().v;
        let kind = 'wire';
        if (this.atKw('reg')) { kind = 'reg'; this.next(); }
        if (this.atKw('signed')) throw vErr(tk.line, "'signed' isn't supported in the Dojo.");
        let range = this.atOp('[') ? this.parseRange(mod) : null;
        while (true) {
          const nm = this.eatId('a port name');
          const existing = mod.signals.get(nm.v);
          if (!existing || !existing.portOnly) {
            if (existing && existing.isPort) throw vErr(nm.line, `Port '${nm.v}' already has a full declaration in the header.`);
            throw vErr(nm.line, `'${nm.v}' isn't in the module's port list, so it can't be declared ${dir} here.`);
          }
          mod.signals.set(nm.v, { kind, width: range ? range.width : 1, dir, isPort: true, line: nm.line });
          const port = mod.ports.find(p => p.name === nm.v);
          if (port) port.dir = dir;
          if (this.atOp(',')) { this.next(); continue; }
          break;
        }
        this.eatOp(';');
        continue;
      }
      if (this.atKw('wire') || this.atKw('reg')) {
        const kind = this.next().v;
        if (this.atKw('signed')) throw vErr(tk.line, "'signed' isn't supported in the Dojo.");
        let range = this.atOp('[') ? this.parseRange(mod) : null;
        while (true) {
          const nm = this.eatId(`a ${kind} name`);
          declare(nm.v, { kind, width: range ? range.width : 1, dir: null, isPort: false, line: nm.line }, nm.line);
          if (this.atOp('=')) {
            this.next();
            const expr = this.parseExpr(mod);
            if (kind === 'wire') {
              mod.assigns.push({ lhs: { kind: 'sig', name: nm.v, line: nm.line }, expr, line: nm.line });
            } else {
              const cv = this.constEval(expr, mod, nm.line);
              mod.signals.get(nm.v).init = logicWiden(asLogic(cv, mod.signals.get(nm.v).width), mod.signals.get(nm.v).width);
            }
          }
          if (this.atOp(',')) { this.next(); continue; }
          break;
        }
        this.eatOp(';');
        continue;
      }
      if (this.atKw('parameter') || this.atKw('localparam')) {
        this.next();
        if (this.atOp('[')) this.parseRange(mod);
        while (true) {
          const nm = this.eatId('a parameter name');
          this.eatOp('=', `after parameter ${nm.v}`);
          const expr = this.parseExpr(mod);
          const val = this.constEval(expr, mod, nm.line);
          if (mod.params.has(nm.v) || mod.signals.has(nm.v)) throw vErr(nm.line, `'${nm.v}' is declared more than once.`);
          mod.params.set(nm.v, val);
          if (this.atOp(',')) { this.next(); continue; }
          break;
        }
        this.eatOp(';');
        continue;
      }
      if (this.atKw('assign')) {
        const aTok = this.next();
        const lhs = this.parseLValue(mod);
        this.eatOp('=', 'in the assign statement');
        const expr = this.parseExpr(mod);
        this.eatOp(';', 'to end the assign');
        mod.assigns.push({ lhs, expr, line: aTok.line });
        continue;
      }
      if (this.atKw('always')) {
        const aTok = this.next();
        if (!this.atOp('@')) throw vErr(this.peek().line, "Expected '@' after 'always'.", "Use always @(*) for combinational logic, always @(posedge clk) for clocked logic.");
        this.next();
        this.eatOp('(', "after 'always @'");
        let kind = null;
        const edges = [];
        if (this.atOp('*')) { this.next(); kind = 'comb'; }
        else {
          while (true) {
            if (this.atKw('posedge')) { this.next(); edges.push(this.eatId('a clock signal after posedge').v); kind = 'clocked'; }
            else if (this.atKw('negedge')) throw vErr(this.peek().line, "negedge isn't supported — the Dojo clocks everything on posedge.");
            else if (this.at('id')) { this.next(); if (!kind) kind = 'comb_list'; }
            else { const t2 = this.peek(); throw vErr(t2.line, `Bad sensitivity list: found ${this.describe(t2)}.`); }
            if (this.atKw('or') || this.atOp(',')) { this.next(); continue; }
            break;
          }
        }
        this.eatOp(')', 'to close the sensitivity list');
        if (kind === 'comb_list') {
          mod.warnings.push({ line: aTok.line, msg: "Manual sensitivity lists go stale. Prefer always @(*) — it tracks every input automatically." });
          kind = 'comb';
        }
        const stmt = this.parseStmt(mod);
        mod.blocks.push({ kind, edges, stmt, line: aTok.line });
        continue;
      }
      if (this.atKw('initial')) throw vErr(tk.line, "initial blocks aren't supported — the Dojo's testbench drives your module for you.", "Use a reset signal to set startup values, like real silicon.");
      if (this.atKw('integer') || this.atKw('genvar')) throw vErr(tk.line, `'${tk.v}' isn't supported in the Dojo. Use reg/wire vectors.`);
      if (this.atKw('for') || this.atKw('while') || this.atKw('repeat') || this.atKw('generate') || this.atKw('function') || this.atKw('task')) {
        throw vErr(tk.line, `'${tk.v}' isn't supported in the Dojo — express it with assigns and always blocks.`);
      }
      if (this.atKw('if') || this.atKw('case') || this.atKw('begin')) {
        throw vErr(tk.line, `'${tk.v}' can't appear directly inside a module — it must live inside an always block.`,
          "Wrap it: always @(*) begin ... end  or  always @(posedge clk) begin ... end");
      }
      if (this.at('id') && this.peek(1).t === 'id') {
        throw vErr(tk.line, `Looks like a module instantiation ('${tk.v} ${this.peek(1).v} ...'). The Dojo runs single, self-contained modules — build the logic inline.`);
      }
      if (this.at('id') && (this.peek(1).t === 'op' && (this.peek(1).v === '=' || this.peek(1).v === '<='))) {
        throw vErr(tk.line, `Assignment to '${tk.v}' needs a home.`,
          "Continuous: assign " + tk.v + " = ...;   Clocked: put " + tk.v + " <= ... inside always @(posedge clk).");
      }
      throw vErr(tk.line, `Unexpected ${this.describe(tk)} at module level.`);
    }
    this.eatKw('endmodule');
    const after = this.peek();
    if (after.t !== 'eof') {
      if (after.t === 'kw' && after.v === 'module') throw vErr(after.line, "Only one module per Dojo challenge — delete the extra one.");
      throw vErr(after.line, `Unexpected ${this.describe(after)} after endmodule.`);
    }
    for (const p of mod.ports) {
      if (!p.dir) throw vErr(p.line, `Port '${p.name}' never got a direction.`, `Add 'input ${p.name};' or 'output ${p.name};' inside the module (or declare it in the header).`);
    }
    return mod;
  }

  parseRange(mod) {
    const open = this.eatOp('[');
    const msbE = this.parseExpr(mod);
    this.eatOp(':', 'in the [msb:lsb] range');
    const lsbE = this.parseExpr(mod);
    this.eatOp(']', 'to close the range');
    const msb = this.constEval(msbE, mod, open.line);
    const lsb = this.constEval(lsbE, mod, open.line);
    if (lsb !== 0) throw vErr(open.line, `Ranges must end at 0 in the Dojo (got [${msb}:${lsb}]). Use [${msb - lsb}:0].`);
    if (msb < lsb) throw vErr(open.line, `Range [${msb}:${lsb}] is backwards — write [msb:lsb] with msb ≥ lsb.`);
    const width = msb - lsb + 1;
    if (width > 32) throw vErr(open.line, `Signals are capped at 32 bits in the Dojo (got ${width}).`);
    return { msb, lsb, width };
  }

  parseLValue(mod) {
    if (this.atOp('{')) {
      const open = this.next();
      const parts = [];
      while (true) {
        parts.push(this.parseLValue(mod));
        if (this.atOp(',')) { this.next(); continue; }
        break;
      }
      this.eatOp('}', 'to close the {…} concatenation target');
      return { kind: 'concat', parts, line: open.line };
    }
    const nm = this.eatId('a signal to assign');
    let node = { kind: 'sig', name: nm.v, line: nm.line };
    if (this.atOp('[')) {
      this.next();
      const a = this.parseExpr(mod);
      if (this.atOp(':')) {
        this.next();
        const b = this.parseExpr(mod);
        this.eatOp(']');
        node = { kind: 'part', name: nm.v, msbE: a, lsbE: b, line: nm.line };
      } else {
        this.eatOp(']');
        node = { kind: 'bit', name: nm.v, idxE: a, line: nm.line };
      }
    }
    return node;
  }

  parseStmt(mod) {
    const tk = this.peek();
    if (this.atKw('begin')) {
      this.next();
      const stmts = [];
      while (!this.atKw('end')) {
        if (this.at('eof')) throw vErr(tk.line, "This 'begin' never found its 'end'.");
        stmts.push(this.parseStmt(mod));
      }
      this.next();
      return { kind: 'block', stmts, line: tk.line };
    }
    if (this.atOp(';')) { this.next(); return { kind: 'empty', line: tk.line }; }
    if (this.atKw('if')) {
      this.next();
      this.eatOp('(', "after 'if'");
      const cond = this.parseExpr(mod);
      this.eatOp(')', 'to close the if condition');
      const then = this.parseStmt(mod);
      let els = null;
      if (this.atKw('else')) { this.next(); els = this.parseStmt(mod); }
      return { kind: 'if', cond, then, els, line: tk.line };
    }
    if (this.atKw('case') || this.atKw('casez') || this.atKw('casex')) {
      if (!this.atKw('case')) throw vErr(tk.line, `${tk.v} isn't supported — use plain 'case'.`);
      this.next();
      this.eatOp('(', "after 'case'");
      const subj = this.parseExpr(mod);
      this.eatOp(')');
      const items = [];
      let def = null;
      while (!this.atKw('endcase')) {
        if (this.at('eof')) throw vErr(tk.line, "This 'case' never found its 'endcase'.");
        if (this.atKw('default')) {
          this.next();
          if (this.atOp(':')) this.next();
          def = this.parseStmt(mod);
          continue;
        }
        const labels = [this.parseExpr(mod)];
        while (this.atOp(',')) { this.next(); labels.push(this.parseExpr(mod)); }
        this.eatOp(':', 'after the case label');
        const body = this.parseStmt(mod);
        items.push({ labels, body, line: tk.line });
      }
      this.next();
      return { kind: 'case', subj, items, def, line: tk.line };
    }
    if (this.atKw('assign')) {
      throw vErr(tk.line, "'assign' doesn't go inside always blocks.", "Inside always, just write: signal = value;  (or <= for clocked).");
    }
    if (this.at('id') || this.atOp('{')) {
      const lhs = this.parseLValue(mod);
      let op = null;
      if (this.atOp('=')) { op = '='; this.next(); }
      else if (this.atOp('<=')) { op = '<='; this.next(); }
      else {
        const t2 = this.peek();
        if (t2.t === 'op' && t2.v === '==') throw vErr(t2.line, "'==' compares — to assign, use '=' (combinational) or '<=' (clocked).");
        throw vErr(t2.line, `Expected '=' or '<=' after the assignment target, found ${this.describe(t2)}.`);
      }
      const expr = this.parseExpr(mod);
      this.eatOp(';', 'to end the assignment');
      return { kind: 'assign', op, lhs, expr, line: tk.line };
    }
    throw vErr(tk.line, `Unexpected ${this.describe(tk)} inside always block.`);
  }

  // ----- expressions (precedence climbing) -----
  parseExpr(mod) { return this.parseTernary(mod); }
  parseTernary(mod) {
    const c = this.parseBin(mod, 0);
    if (this.atOp('?')) {
      const q = this.next();
      const t = this.parseExpr(mod);
      this.eatOp(':', "for the '?:' false branch");
      const f = this.parseExpr(mod);
      return { kind: 'tern', c, t, f, line: q.line };
    }
    return c;
  }
  parseBin(mod, lvl) {
    const LEVELS = [
      ['||'], ['&&'], ['|'], ['^', '~^'], ['&'],
      ['===', '!==', '==', '!='], ['<', '<=', '>', '>='], ['<<', '>>'], ['+', '-'], ['*', '/', '%']
    ];
    if (lvl >= LEVELS.length) return this.parseUnary(mod);
    let left = this.parseBin(mod, lvl + 1);
    while (this.at('op') && LEVELS[lvl].includes(this.peek().v)) {
      const opTok = this.next();
      const right = this.parseBin(mod, lvl + 1);
      left = { kind: 'bin', op: opTok.v, l: left, r: right, line: opTok.line };
    }
    return left;
  }
  parseUnary(mod) {
    const tk = this.peek();
    if (tk.t === 'op' && ['~', '!', '-', '+', '&', '|', '^', '~&', '~|', '~^'].includes(tk.v)) {
      this.next();
      const operand = this.parseUnary(mod);
      if (tk.v === '+') return operand;
      return { kind: 'un', op: tk.v, e: operand, line: tk.line };
    }
    return this.parsePostfix(mod);
  }
  parsePostfix(mod) {
    let node = this.parsePrimary(mod);
    while (this.atOp('[')) {
      if (node.kind !== 'sig') throw vErr(this.peek().line, "Bit selects like [3] only apply to named signals in the Dojo.");
      this.next();
      const a = this.parseExpr(mod);
      if (this.atOp(':')) {
        this.next();
        const b = this.parseExpr(mod);
        this.eatOp(']');
        node = { kind: 'part', name: node.name, msbE: a, lsbE: b, line: node.line };
      } else {
        this.eatOp(']');
        node = { kind: 'bit', name: node.name, idxE: a, line: node.line };
      }
    }
    return node;
  }
  parsePrimary(mod) {
    const tk = this.peek();
    if (tk.t === 'num') {
      this.next();
      const L = litValue(tk);
      return { kind: 'num', v: L.v, w: L.w, xz: L.xz || 0, z: L.z || 0, line: tk.line };
    }
    if (tk.t === 'id') { this.next(); return { kind: 'sig', name: tk.v, line: tk.line }; }
    if (this.atOp('(')) {
      this.next();
      const e = this.parseExpr(mod);
      this.eatOp(')', 'to close the parenthesis');
      return e;
    }
    if (this.atOp('{')) {
      this.next();
      const first = this.parseExpr(mod);
      if (this.atOp('{')) {
        // replication {N{expr}}
        this.next();
        const rep = this.parseExpr(mod);
        this.eatOp('}', 'to close the replication');
        this.eatOp('}', 'to close the outer concatenation');
        return { kind: 'repl', countE: first, e: rep, line: tk.line };
      }
      const parts = [first];
      while (this.atOp(',')) { this.next(); parts.push(this.parseExpr(mod)); }
      this.eatOp('}', 'to close the {…} concatenation');
      return { kind: 'concat', parts, line: tk.line };
    }
    if (tk.t === 'kw') throw vErr(tk.line, `'${tk.v}' can't appear inside an expression.`);
    throw vErr(tk.line, `Expected a value here, found ${this.describe(tk)}.`);
  }

  constEval(node, mod, line) {
    const val = evalExpr(node, {
      get: (name, ln) => {
        if (mod.params.has(name)) return logic01(mod.params.get(name), 32);
        throw vErr(ln, `'${name}' isn't a constant — only numbers and parameters work here.`);
      }
    }, mod);
    if (val.xz) throw vErr(line, "Constant expression resolved to X/Z — widths and ranges need a known number.");
    return val.v;
  }
}

// ---------------- Expression evaluation ----------------
// env: { get(name, line) -> LogicVec {v,xz,z,w} }
function evalExpr(node, env, mod) {
  switch (node.kind) {
    case 'num': return asLogic(node, node.w);
    case 'sig': {
      if (mod && mod.params.has(node.name)) return logic01(mod.params.get(node.name), 32);
      return asLogic(env.get(node.name, node.line));
    }
    case 'bit': {
      const sig = (mod && mod.params.has(node.name))
        ? logic01(mod.params.get(node.name), 32)
        : asLogic(env.get(node.name, node.line));
      const idx = evalExpr(node.idxE, env, mod);
      if (idx.xz) return logicX(1);
      if (idx.v >= sig.w) return logic01(0, 1);
      const b = bitAt(sig, idx.v);
      if (b === 'z') return { v: 0, xz: 1, z: 1, w: 1 };
      if (b === 'x') return logicX(1);
      return logic01(b ? 1 : 0, 1);
    }
    case 'part': {
      const sig = asLogic(env.get(node.name, node.line));
      const msbL = evalExpr(node.msbE, env, mod);
      const lsbL = evalExpr(node.lsbE, env, mod);
      if (msbL.xz || lsbL.xz) throw vErr(node.line, `Part-select on '${node.name}' needs a known range.`);
      const msb = msbL.v, lsb = lsbL.v;
      if (msb < lsb) throw vErr(node.line, `Part-select [${msb}:${lsb}] on '${node.name}' is backwards.`);
      if (msb >= sig.w) throw vErr(node.line, `Bit ${msb} doesn't exist — '${node.name}' is [${sig.w - 1}:0].`);
      return sliceLogic(sig, msb, lsb);
    }
    case 'concat': {
      const parts = node.parts.map((p) => evalExpr(p, env, mod));
      const w = parts.reduce((s, p) => s + p.w, 0);
      if (w > 32) throw vErr(node.line, "Concatenation wider than 32 bits isn't supported.");
      return concatLogic(parts);
    }
    case 'repl': {
      const countL = evalExpr(node.countE, env, mod);
      if (countL.xz) throw vErr(node.line, 'Replication count must be a known constant.');
      const count = countL.v;
      const r = evalExpr(node.e, env, mod);
      if (count < 1 || count * r.w > 32) throw vErr(node.line, `Replication {${count}{…}} is out of range (max 32 bits total).`);
      const parts = [];
      for (let i = 0; i < count; i++) parts.push(r);
      return concatLogic(parts);
    }
    case 'un': {
      const a = evalExpr(node.e, env, mod);
      switch (node.op) {
        case '~': return logicNot(a);
        case '!': return logicLogNot(a);
        case '-': return a.xz ? logicX(a.w) : logic01(maskW(-a.v, a.w), a.w);
        case '&': return reduction(a, (x, y) => {
          const A = x === 1 ? 1 : x === 0 ? 0 : 'x';
          const B = y === 1 ? 1 : y === 0 ? 0 : (y === 'z' ? 'x' : y);
          if (A === 0 || B === 0) return 0;
          if (A === 1 && B === 1) return 1;
          return 'x';
        }, 1);
        case '|': return reduction(a, (x, y) => {
          if (x === 1 || y === 1) return 1;
          if ((x === 0 || x === 1) && (y === 0 || y === 1) && x === 0 && y === 0) return 0;
          if (x === 0 && y === 0) return 0;
          return 'x';
        }, 0);
        case '^': return reduction(a, (x, y) => {
          if (x === 'x' || x === 'z' || y === 'x' || y === 'z') return 'x';
          return (x ? 1 : 0) ^ (y ? 1 : 0);
        }, 0);
        case '~&': { const r = evalExpr({ ...node, op: '&' }, env, mod); return logicNot(r); }
        case '~|': { const r = evalExpr({ ...node, op: '|' }, env, mod); return logicNot(r); }
        case '~^': { const r = evalExpr({ ...node, op: '^' }, env, mod); return logicNot(r); }
      }
      throw vErr(node.line, `Unknown unary op '${node.op}'.`);
    }
    case 'bin': {
      const a = evalExpr(node.l, env, mod);
      const b = evalExpr(node.r, env, mod);
      const wmax = Math.max(a.w, b.w);
      switch (node.op) {
        case '+': { const w = Math.min(32, wmax + 1); return logicArith('+', a, b, w); }
        case '-': { const w = Math.min(32, wmax + 1); return logicArith('-', a, b, w); }
        case '*': { const w = Math.min(32, a.w + b.w); return logicArith('*', a, b, w); }
        case '/': {
          if (!b.xz && b.v === 0) throw vErr(node.line, "Division by zero during simulation.");
          return logicArith('/', a, b, wmax);
        }
        case '%': {
          if (!b.xz && b.v === 0) throw vErr(node.line, "Modulo by zero during simulation.");
          return logicArith('%', a, b, wmax);
        }
        case '&': return logicAnd(a, b, wmax);
        case '|': return logicOr(a, b, wmax);
        case '^': return logicXor(a, b, wmax);
        case '~^': return logicXnor(a, b, wmax);
        case '==': return logicEq(a, b);
        case '!=': return logicNeq(a, b);
        case '===': return logicEqCase(a, b);
        case '!==': return logicNeqCase(a, b);
        case '<': case '<=': case '>': case '>=': return logicCmpRel(node.op, a, b);
        case '&&': return logicLogAnd(a, b);
        case '||': return logicLogOr(a, b);
        case '<<': return logicShiftLeft(a, b, Math.min(32, a.w + Math.min(b.xz ? 0 : b.v, 32)));
        case '>>': return logicShiftRight(a, b);
        case '**': throw vErr(node.line, "'**' (power) isn't supported in the Dojo.");
      }
      throw vErr(node.line, `Unknown operator '${node.op}'.`);
    }
    case 'tern': {
      const c = evalExpr(node.c, env, mod);
      const t = evalExpr(node.t, env, mod);
      const f = evalExpr(node.f, env, mod);
      return logicTern(c, t, f);
    }
  }
  throw vErr(node.line || 1, "Internal: unknown expression node.");
}
function bitop(a, b, w, fn) {
  let av = maskW(a.v, w), bv = maskW(b.v, w), out = 0, bit = 1;
  for (let i = 0; i < w; i++) {
    out += fn(av % 2, bv % 2) * bit;
    av = Math.floor(av / 2); bv = Math.floor(bv / 2); bit *= 2;
  }
  return out;
}

// ---------------- Static expression walk (declared-name check) ----------------
function walkExprNames(node, fn) {
  if (!node || typeof node !== 'object') return;
  switch (node.kind) {
    case 'sig': fn(node.name, node.line); return;
    case 'bit': fn(node.name, node.line); walkExprNames(node.idxE, fn); return;
    case 'part': fn(node.name, node.line); walkExprNames(node.msbE, fn); walkExprNames(node.lsbE, fn); return;
    case 'concat': node.parts.forEach(p => walkExprNames(p, fn)); return;
    case 'repl': walkExprNames(node.countE, fn); walkExprNames(node.e, fn); return;
    case 'un': walkExprNames(node.e, fn); return;
    case 'bin': walkExprNames(node.l, fn); walkExprNames(node.r, fn); return;
    case 'tern': walkExprNames(node.c, fn); walkExprNames(node.t, fn); walkExprNames(node.f, fn); return;
  }
}
function walkStmt(stmt, fns) {
  if (!stmt) return;
  switch (stmt.kind) {
    case 'block': stmt.stmts.forEach(s => walkStmt(s, fns)); return;
    case 'if':
      fns.expr && fns.expr(stmt.cond);
      walkStmt(stmt.then, fns); walkStmt(stmt.els, fns); return;
    case 'case':
      fns.expr && fns.expr(stmt.subj);
      stmt.items.forEach(it => { it.labels.forEach(l => fns.expr && fns.expr(l)); walkStmt(it.body, fns); });
      walkStmt(stmt.def, fns); return;
    case 'assign': fns.assign && fns.assign(stmt); fns.expr && fns.expr(stmt.expr); return;
    case 'empty': return;
  }
}
function lvalueNames(lhs) {
  if (lhs.kind === 'concat') return lhs.parts.flatMap(lvalueNames);
  return [{ name: lhs.name, full: lhs.kind === 'sig', line: lhs.line, node: lhs }];
}

// ---------------- Semantic checks ----------------
function checkSemantics(mod, iface) {
  const errs = [];
  const E = (line, msg, hint) => errs.push({ line, msg, hint });

  // Interface match
  if (iface) {
    if (iface.name && mod.name !== iface.name) {
      E(mod.line, `Module must be named '${iface.name}' (found '${mod.name}').`);
    }
    const want = new Map(iface.ports.map(p => [p.n, p]));
    for (const p of mod.ports) {
      const sig = mod.signals.get(p.name);
      const spec = want.get(p.name);
      if (!spec) { E(p.line, `Unexpected port '${p.name}' — this challenge's interface doesn't include it.`); continue; }
      const dirWant = spec.d === 'in' ? 'input' : 'output';
      if (sig.dir !== dirWant) E(p.line, `Port '${p.name}' should be an ${dirWant} (found ${sig.dir}).`);
      if (sig.width !== spec.w) E(p.line, `Port '${p.name}' should be ${spec.w} bit${spec.w > 1 ? 's' : ''} wide${spec.w > 1 ? ` — declare it [${spec.w - 1}:0]` : ''} (found ${sig.width}).`);
      want.delete(p.name);
    }
    for (const [n, spec] of want) {
      E(mod.line, `Missing port '${n}' (${spec.d === 'in' ? 'input' : 'output'}, ${spec.w} bit${spec.w > 1 ? 's' : ''}).`);
    }
  }

  // Name resolution
  const known = (name) => mod.signals.has(name) || mod.params.has(name);
  const checkExpr = (expr) => walkExprNames(expr, (name, line) => {
    if (!known(name)) E(line, `'${name}' isn't declared.`, `Add a declaration like: wire ${name};  (or check the spelling).`);
  });

  const drivers = new Map(); // name -> {assignFull, assignPart, blocks:Set}
  const getDrv = (name) => {
    if (!drivers.has(name)) drivers.set(name, { assignFull: 0, assignPart: 0, blocks: new Set(), lines: [] });
    return drivers.get(name);
  };

  for (const a of mod.assigns) {
    checkExpr(a.expr);
    for (const t of lvalueNames(a.lhs)) {
      if (!known(t.name)) { E(t.line, `'${t.name}' isn't declared.`); continue; }
      if (mod.params.has(t.name)) { E(t.line, `'${t.name}' is a parameter — it can't be assigned.`); continue; }
      const sig = mod.signals.get(t.name);
      if (sig.dir === 'input') { E(a.line, `'${t.name}' is an input — your module receives it, it can't drive it.`); continue; }
      if (sig.kind === 'reg') {
        E(a.line, `'${t.name}' is a reg, so 'assign' can't drive it.`,
          `Either drive it inside an always block, or declare it as a wire and keep the assign.`);
        continue;
      }
      const d = getDrv(t.name);
      if (t.full) d.assignFull++; else d.assignPart++;
      d.lines.push(a.line);
      if (t.node.kind === 'part') {
        // verify static part bounds
        try {
          const msb = new VParser([]).constEval ? null : null;
        } catch (e) { /* checked at runtime */ }
      }
    }
  }

  mod.blocks.forEach((b, bi) => {
    if (b.kind === 'clocked') {
      const ifaceHasClk = !iface || iface.ports.some(p => p.n === 'clk');
      if (ifaceHasClk && !b.edges.includes('clk')) {
        E(b.line, `This clocked block isn't sensitive to the clock.`, `Use: always @(posedge clk) — extra edges like 'or posedge rst' are fine.`);
      }
      for (const e of b.edges) {
        if (!known(e)) E(b.line, `'${e}' in the sensitivity list isn't declared.`);
      }
    }
    walkStmt(b.stmt, {
      expr: checkExpr,
      assign: (st) => {
        if (b.kind === 'clocked' && st.op === '=') {
          E(st.line, `Blocking '=' inside a clocked always block.`,
            `Clocked logic uses non-blocking '<=' so every register samples its input at the same instant. Change '=' to '<='.`);
        }
        if (b.kind === 'comb' && st.op === '<=') {
          E(st.line, `Non-blocking '<=' inside always @(*).`,
            `Combinational logic uses blocking '='. Save '<=' for always @(posedge clk).`);
        }
        for (const t of lvalueNames(st.lhs)) {
          if (!known(t.name)) { E(t.line, `'${t.name}' isn't declared.`, `Declare it: reg ${t.name};`); continue; }
          if (mod.params.has(t.name)) { E(t.line, `'${t.name}' is a parameter — it can't be assigned.`); continue; }
          const sig = mod.signals.get(t.name);
          if (sig.dir === 'input') { E(st.line, `'${t.name}' is an input — it can't be assigned inside the module.`); continue; }
          if (sig.kind !== 'reg') {
            E(st.line, `'${t.name}' is a wire, but anything assigned inside an always block must be a reg.`,
              sig.dir === 'output' ? `Declare the port as 'output reg${sig.width > 1 ? ` [${sig.width - 1}:0]` : ''} ${t.name}'.` : `Change its declaration to: reg${sig.width > 1 ? ` [${sig.width - 1}:0]` : ''} ${t.name};`);
            continue;
          }
          const d = getDrv(t.name);
          d.blocks.add(bi);
          d.lines.push(st.line);
        }
      }
    });
  });

  for (const [name, d] of drivers) {
    const fromAssign = d.assignFull + d.assignPart > 0;
    const fromBlocks = d.blocks.size > 0;
    if (fromAssign && fromBlocks) {
      E(d.lines[0], `'${name}' is driven by both an assign and an always block — pick one driver.`);
    } else if (d.assignFull > 1 || (d.assignFull >= 1 && d.assignPart >= 1)) {
      mod.warnings.push({
        line: d.lines[0],
        msg: `'${name}' has multiple assign drivers — they resolve as a bus (Z yields, 0/1 contention becomes X).`,
      });
    } else if (d.blocks.size > 1) {
      E(d.lines[0], `'${name}' is written from ${d.blocks.size} different always blocks — keep each register in exactly one block.`);
    }
  }

  // every output driven?
  for (const p of mod.ports) {
    const sig = mod.signals.get(p.name);
    if (sig.dir === 'output' && !drivers.has(p.name)) {
      E(p.line, `Output '${p.name}' is never driven — it would float as X in real silicon.`,
        `Add: assign ${p.name} = …;  or drive it from an always block.`);
    }
  }

  return errs;
}

// ---------------- Simulator ----------------
class VSim {
  constructor(mod) {
    this.mod = mod;
    this.vals = new Map();
    for (const [name, sig] of mod.signals) {
      if (sig.init !== undefined) {
        this.vals.set(name, logicWiden(asLogic(sig.init, sig.width), sig.width));
      } else if (sig.kind === 'reg') {
        this.vals.set(name, logicX(sig.width));
      } else {
        // Wires start at 0 so combinational loops like assign y = ~y still
        // oscillate (and get diagnosed) instead of collapsing to X.
        this.vals.set(name, logic01(0, sig.width));
      }
    }
  }
  width(name) { return this.mod.signals.get(name).width; }
  get(name) { return this.vals.get(name); }
  snapshot() {
    const m = new Map();
    for (const [k, v] of this.vals) m.set(k, { v: v.v, xz: v.xz || 0, z: v.z || 0, w: v.w });
    return m;
  }
  restore(snap) {
    this.vals = new Map();
    for (const [k, v] of snap) this.vals.set(k, { v: v.v, xz: v.xz, z: v.z, w: v.w });
  }
  setInput(name, v) {
    const sig = this.mod.signals.get(name);
    this.vals.set(name, logicWiden(asLogic(v, sig.width), sig.width));
  }
  envReader() {
    return {
      get: (name, line) => {
        if (this.mod.params.has(name)) return logic01(this.mod.params.get(name), 32);
        if (!this.vals.has(name)) throw vErr(line, `'${name}' isn't declared.`);
        return asLogic(this.vals.get(name), this.width(name));
      }
    };
  }
  writeTarget(lhs, value, env) {
    if (lhs.kind === 'concat') {
      const parts = lhs.parts.map(p => ({ node: p, w: this.targetWidth(p, env) }));
      const total = parts.reduce((s, p) => s + p.w, 0);
      let cur = logicWiden(asLogic(value, total), total);
      for (let i = parts.length - 1; i >= 0; i--) {
        const segW = parts[i].w;
        this.writeTarget(parts[i].node, sliceLogic(cur, segW - 1, 0), env);
        cur = {
          v: cur.v >>> segW,
          xz: (cur.xz || 0) >>> segW,
          z: (cur.z || 0) >>> segW,
          w: Math.max(1, cur.w - segW),
        };
      }
      return;
    }
    const sig = this.mod.signals.get(lhs.name);
    if (lhs.kind === 'sig') {
      this.vals.set(lhs.name, logicWiden(asLogic(value, sig.width), sig.width));
      return;
    }
    if (lhs.kind === 'bit') {
      const idxL = evalExpr(lhs.idxE, env, this.mod);
      if (idxL.xz) throw vErr(lhs.line, `Bit-select index on '${lhs.name}' is X/Z.`);
      const idx = idxL.v;
      if (idx >= sig.width) throw vErr(lhs.line, `Bit ${idx} doesn't exist — '${lhs.name}' is [${sig.width - 1}:0].`);
      const cur = asLogic(this.vals.get(lhs.name), sig.width);
      this.vals.set(lhs.name, bitSet(cur, idx, value));
      return;
    }
    if (lhs.kind === 'part') {
      const msbL = evalExpr(lhs.msbE, env, this.mod);
      const lsbL = evalExpr(lhs.lsbE, env, this.mod);
      if (msbL.xz || lsbL.xz) throw vErr(lhs.line, `Part-select on '${lhs.name}' needs a known range.`);
      const msb = msbL.v, lsb = lsbL.v;
      if (msb < lsb) throw vErr(lhs.line, `Part-select [${msb}:${lsb}] is backwards.`);
      if (msb >= sig.width) throw vErr(lhs.line, `Bit ${msb} doesn't exist — '${lhs.name}' is [${sig.width - 1}:0].`);
      const cur = asLogic(this.vals.get(lhs.name), sig.width);
      this.vals.set(lhs.name, partSet(cur, msb, lsb, value));
      return;
    }
  }
  targetWidth(lhs, env) {
    if (lhs.kind === 'concat') return lhs.parts.reduce((s, p) => s + this.targetWidth(p, env), 0);
    const sig = this.mod.signals.get(lhs.name);
    if (lhs.kind === 'sig') return sig.width;
    if (lhs.kind === 'bit') return 1;
    const msb = evalExpr(lhs.msbE, env, this.mod).v;
    const lsb = evalExpr(lhs.lsbE, env, this.mod).v;
    return msb - lsb + 1;
  }
  execStmt(stmt, env, nbList) {
    switch (stmt.kind) {
      case 'empty': return;
      case 'block': for (const s of stmt.stmts) this.execStmt(s, env, nbList); return;
      case 'if': {
        const c = evalExpr(stmt.cond, env, this.mod);
        if (!c.xz) {
          if (c.v !== 0) this.execStmt(stmt.then, env, nbList);
          else if (stmt.els) this.execStmt(stmt.els, env, nbList);
        }
        // X condition: hold (neither branch) — ternary X-merge is handled in evalExpr
        return;
      }
      case 'case': {
        const subj = evalExpr(stmt.subj, env, this.mod);
        for (const it of stmt.items) {
          for (const lab of it.labels) {
            const lv = evalExpr(lab, env, this.mod);
            if (logicEqCase(lv, subj).v) { this.execStmt(it.body, env, nbList); return; }
          }
        }
        if (stmt.def) this.execStmt(stmt.def, env, nbList);
        return;
      }
      case 'assign': {
        const val = evalExpr(stmt.expr, env, this.mod);
        if (stmt.op === '<=' && nbList) nbList.push({ lhs: stmt.lhs, value: val });
        else this.writeTarget(stmt.lhs, val, env);
        return;
      }
    }
  }
  settle() {
    const env = this.envReader();
    let events = 0;
    let lastChanged = [];
    for (let iter = 0; iter < SIM_MAX_DELTA; iter++) {
      const before = this.snapshot();
      const driven = new Map();
      for (const a of this.mod.assigns) {
        const val = evalExpr(a.expr, env, this.mod);
        if (a.lhs.kind === 'sig') {
          const w = this.width(a.lhs.name);
          if (!driven.has(a.lhs.name)) driven.set(a.lhs.name, []);
          driven.get(a.lhs.name).push(logicWiden(asLogic(val, w), w));
        } else {
          this.writeTarget(a.lhs, val, env);
        }
        if (++events > SIM_MAX_EVENTS) throw this._loopErr(lastChanged, 'event');
      }
      for (const [name, ds] of driven) {
        this.vals.set(name, resolveDrivers(ds, this.width(name)));
      }
      for (const b of this.mod.blocks) {
        if (b.kind === 'comb') this.execStmt(b.stmt, env, null);
        if (++events > SIM_MAX_EVENTS) throw this._loopErr(lastChanged, 'event');
      }
      const changed = [];
      for (const [k, v] of this.vals) {
        if (!logicSame(before.get(k), v)) changed.push(k);
      }
      if (!changed.length) return { deltaCycles: iter + 1, events };
      lastChanged = changed;
    }
    throw this._loopErr(lastChanged, 'delta');
  }
  _loopErr(signals, kind) {
    const named = (signals && signals.length) ? signals.join(', ') : 'unknown nets';
    const msg = kind === 'event'
      ? `Simulation event budget exceeded (${SIM_MAX_EVENTS}) — combinational loop involving ${named}.`
      : `Combinational loop detected involving ${named} — a signal feeds back into itself without a register in the path.`;
    const err = vErr(this.mod.line, msg,
      "Something like 'assign y = ~y;' oscillates forever. Break the loop with a flip-flop, or rethink the logic.");
    err.signals = signals || [];
    err.code = 'COMBINATIONAL_LOOP';
    return err;
  }
  clock() {
    const env = this.envReader();
    const nbList = [];
    for (const b of this.mod.blocks) {
      if (b.kind === 'clocked') this.execStmt(b.stmt, env, nbList);
    }
    for (const u of nbList) this.writeTarget(u.lhs, u.value, env);
    this.settle();
  }
}

// ---------------- Compile entry ----------------
function vCompile(src, iface) {
  try {
    const toks = vTokenize(src);
    const parser = new VParser(toks);
    const mod = parser.parseModule();
    const errs = checkSemantics(mod, iface);
    if (errs.length) return { ok: false, errors: errs, warnings: mod.warnings };
    return { ok: true, mod, warnings: mod.warnings, errors: [] };
  } catch (e) {
    if (e.isVerilogError) return { ok: false, errors: [{ line: e.line, msg: e.message, hint: e.hint }], warnings: [] };
    return { ok: false, errors: [{ line: 0, msg: 'Internal engine error: ' + e.message, hint: null }], warnings: [] };
  }
}

// ---------------- Test runners ----------------
// Combinational: vectors = [{in:{a:0,b:1}, out:{y:1}}]
function runCombTest(mod, vectors) {
  const rows = [];
  let passCount = 0;
  for (const vec of vectors) {
    const sim = new VSim(mod);
    try {
      for (const [k, v] of Object.entries(vec.in)) sim.setInput(k, v);
      sim.settle();
      const got = {};
      let ok = true;
      for (const [k, v] of Object.entries(vec.out)) {
        got[k] = sim.get(k);
        if (!valuesEqual(got[k], v)) ok = false;
      }
      rows.push({ in: vec.in, expect: vec.out, got, ok });
      if (ok) passCount++;
    } catch (e) {
      if (!e.isVerilogError) throw e;
      return { pass: false, rows, runtimeError: { line: e.line, msg: e.message, hint: e.hint }, passCount, total: vectors.length };
    }
  }
  return { pass: passCount === vectors.length, rows, passCount, total: vectors.length };
}

// Sequential: frames = [{inputs...}], ref = {step(frame)->outputs}
// Returns waveform-friendly trace.
function runSeqTest(mod, frames, makeRef, watchOuts, expectedRows) {
  const sim = new VSim(mod);
  const ref = typeof makeRef === 'function' ? makeRef() : null;
  const trace = [];
  let passCount = 0;
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    try {
      for (const [k, v] of Object.entries(frame)) sim.setInput(k, v);
      sim.settle();
      sim.clock();
      const exp = expectedRows ? expectedRows[i] : ref.step(frame);
      const got = {};
      let ok = true;
      for (const o of watchOuts) {
        got[o] = sim.get(o);
        if (!valuesEqual(got[o], exp[o])) ok = false;
      }
      trace.push({ in: { ...frame }, expect: exp, got, ok });
      if (ok) passCount++;
    } catch (e) {
      if (!e.isVerilogError) throw e;
      return { pass: false, trace, runtimeError: { line: e.line, msg: e.message, hint: e.hint, signals: e.signals }, passCount, total: frames.length };
    }
  }
  return { pass: passCount === frames.length, trace, passCount, total: frames.length };
}

function valuesEqual(got, exp) {
  return valuesEqualLogic(got, exp);
}

function runChallengeTest(mod, test) {
  if (test.type === 'comb') return { kind: 'comb', ...runCombTest(mod, test.vectors) };
  return { kind: 'seq', ...runSeqTest(mod, test.frames, test.makeRef, test.watch, test.expected) };
}

function serializeTest(test) {
  if (!test) return test;
  if (test.type === 'comb') return { type: 'comb', vectors: test.vectors };
  let expected = test.expected;
  if (!expected && typeof test.makeRef === 'function') {
    const ref = test.makeRef();
    expected = (test.frames || []).map((frame) => ref.step(frame));
  }
  return { type: 'seq', frames: test.frames, watch: test.watch, expected };
}

export {
  V_KEYWORDS,
  vErr,
  pow2,
  maskW,
  vTokenize,
  litValue,
  VParser,
  evalExpr,
  bitop,
  walkExprNames,
  walkStmt,
  lvalueNames,
  checkSemantics,
  VSim,
  vCompile,
  runCombTest,
  runSeqTest,
  runChallengeTest,
  serializeTest,
  valuesEqual,
  SIM_MAX_DELTA,
  SIM_MAX_EVENTS,
};
