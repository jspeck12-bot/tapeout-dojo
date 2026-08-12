import { createRequire } from 'node:module';
import { beforeAll, describe, expect, test } from 'vitest';
import {
  runCombTest,
  runSeqTest,
  vCompile,
  vTokenize,
} from '../src/engine/verilog.js';
import { genTTWrapper } from '../src/engine/debug/rtl-export.js';

const require = createRequire(import.meta.url);
const shared = require('../dev/_shared.cjs');

let gameModule;

const port = (n, d, w = 1) => ({ n, d, w });
const iface = (name, ports) => ({ name, ports });

function compile(source, spec) {
  const result = vCompile(source, spec);
  expect(result.errors, result.errors?.map((e) => e.msg).join('\n')).toEqual([]);
  expect(result.ok).toBe(true);
  return result.mod;
}

describe('tokenizer and parser diagnostics', () => {
  test('tokenizes comments, keywords, identifiers, and sized literals', () => {
    const tokens = vTokenize(`
      // line comment
      module demo(input [3:0] a, output y);
        /* block comment */ assign y = &a | 1'b0;
      endmodule
    `);

    expect(tokens.some((t) => t.t === 'kw' && t.v === 'module')).toBe(true);
    expect(tokens.some((t) => t.t === 'id' && t.v === 'demo')).toBe(true);
    expect(tokens.some((t) => t.t === 'num' && t.v.width === 1 && t.v.digits === '0')).toBe(true);
    expect(tokens.at(-1).t).toBe('eof');
  });

  test('reports a missing statement semicolon with a useful hint', () => {
    const result = vCompile(
      'module m(input a, output y); assign y = a endmodule',
      iface('m', [port('a', 'in'), port('y', 'out')]),
    );

    expect(result.ok).toBe(false);
    expect(result.errors[0].msg).toMatch(/Expected ';'/);
    expect(result.errors[0].hint).toMatch(/semicolon/i);
  });

  test('rejects four-state literals explicitly', () => {
    const result = vCompile(
      "module m(output y); assign y = 1'bx; endmodule",
      iface('m', [port('y', 'out')]),
    );

    expect(result.ok).toBe(false);
    expect(result.errors[0].msg).toMatch(/x \/ z values aren't supported/i);
  });

  test('rejects undeclared signals and mismatched interfaces', () => {
    const undeclared = vCompile(
      'module m(input a, output y); assign y = missing; endmodule',
      iface('m', [port('a', 'in'), port('y', 'out')]),
    );
    expect(undeclared.ok).toBe(false);
    expect(undeclared.errors.some((e) => /isn't declared/.test(e.msg))).toBe(true);

    const wrongWidth = vCompile(
      'module m(input [1:0] a, output y); assign y = &a; endmodule',
      iface('m', [port('a', 'in', 4), port('y', 'out')]),
    );
    expect(wrongWidth.ok).toBe(false);
    expect(wrongWidth.errors.some((e) => /4 bits wide/.test(e.msg))).toBe(true);
  });
});

describe('expressions and width propagation', () => {
  test('honors multiplication and bitwise operator precedence', () => {
    const spec = iface('m', [
      port('a', 'in', 4), port('b', 'in', 4), port('c', 'in', 4),
      port('sum', 'out', 8), port('flag', 'out', 4),
    ]);
    const mod = compile(`
      module m(input [3:0] a, input [3:0] b, input [3:0] c,
               output [7:0] sum, output [3:0] flag);
        assign sum = a + b * c;
        assign flag = a | b & c;
      endmodule
    `, spec);

    const result = runCombTest(mod, [
      { in: { a: 1, b: 2, c: 3 }, out: { sum: 7, flag: 3 } },
      { in: { a: 0, b: 3, c: 2 }, out: { sum: 6, flag: 2 } },
    ]);
    expect(result.pass).toBe(true);
  });

  test('propagates carry width and resolves parameters in ranges', () => {
    const spec = iface('addw', [
      port('a', 'in', 4), port('b', 'in', 4), port('y', 'out', 5),
    ]);
    const mod = compile(`
      module addw(input [3:0] a, input [3:0] b, output [4:0] y);
        parameter W = 4;
        wire [W:0] sum;
        assign sum = a + b;
        assign y = sum;
      endmodule
    `, spec);

    expect(runCombTest(mod, [
      { in: { a: 15, b: 1 }, out: { y: 16 } },
      { in: { a: 15, b: 15 }, out: { y: 30 } },
    ]).pass).toBe(true);
  });

  test('supports concatenation, replication, and part selects', () => {
    const spec = iface('pack', [port('a', 'in', 4), port('y', 'out', 8), port('hi', 'out', 2)]);
    const mod = compile(`
      module pack(input [3:0] a, output [7:0] y, output [1:0] hi);
        assign y = {2{a}};
        assign hi = a[3:2];
      endmodule
    `, spec);

    expect(runCombTest(mod, [
      { in: { a: 10 }, out: { y: 170, hi: 2 } },
    ]).pass).toBe(true);
  });
});

describe('procedural and event semantics', () => {
  test('blocking assignments update subsequent combinational statements', () => {
    const spec = iface('comb', [port('a', 'in'), port('tmp', 'out'), port('y', 'out')]);
    const mod = compile(`
      module comb(input a, output reg tmp, output reg y);
        always @(*) begin
          tmp = a;
          y = tmp;
        end
      endmodule
    `, spec);

    expect(runCombTest(mod, [
      { in: { a: 0 }, out: { tmp: 0, y: 0 } },
      { in: { a: 1 }, out: { tmp: 1, y: 1 } },
    ]).pass).toBe(true);
  });

  test('non-blocking assignments sample old register values together', () => {
    const spec = iface('pipe', [
      port('clk', 'in'), port('d', 'in'), port('q', 'out'), port('r', 'out'),
    ]);
    const mod = compile(`
      module pipe(input clk, input d, output reg q, output reg r);
        always @(posedge clk) begin
          q <= d;
          r <= q;
        end
      endmodule
    `, spec);
    const frames = [{ d: 1 }, { d: 0 }, { d: 1 }];
    const result = runSeqTest(mod, frames, () => {
      let q = 0;
      return {
        step(frame) {
          const oldQ = q;
          q = frame.d;
          return { q, r: oldQ };
        },
      };
    }, ['q', 'r']);

    expect(result.pass).toBe(true);
    expect(result.trace.map((row) => row.got)).toEqual([
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: 1, r: 0 },
    ]);
  });

  test('enforces assignment style for combinational and clocked blocks', () => {
    const spec = iface('bad', [port('clk', 'in'), port('a', 'in'), port('y', 'out')]);
    const clocked = vCompile(
      'module bad(input clk, input a, output reg y); always @(posedge clk) y = a; endmodule',
      spec,
    );
    expect(clocked.ok).toBe(false);
    expect(clocked.errors.some((e) => /Blocking '=' inside a clocked/.test(e.msg))).toBe(true);

    const combinational = vCompile(
      'module bad(input clk, input a, output reg y); always @(*) y <= a; endmodule',
      spec,
    );
    expect(combinational.ok).toBe(false);
    expect(combinational.errors.some((e) => /Non-blocking '<=' inside/.test(e.msg))).toBe(true);
  });

  test('reports a runtime error for combinational feedback', () => {
    const spec = iface('loop', [port('y', 'out')]);
    const mod = compile('module loop(output y); assign y = ~y; endmodule', spec);
    const result = runCombTest(mod, [{ in: {}, out: { y: 0 } }]);

    expect(result.pass).toBe(false);
    expect(result.runtimeError?.msg).toMatch(/Combinational loop detected/);
  });
});

describe('hardware view and RTL export', () => {
  beforeAll(() => {
    gameModule = shared.loadMod();
  });

  test('marks an uncovered combinational path as a latch', () => {
    const spec = iface('latchy', [port('en', 'in'), port('d', 'in'), port('y', 'out')]);
    const mod = compile(`
      module latchy(input en, input d, output reg y);
        always @(*) if (en) y = d;
      endmodule
    `, spec);
    const netlist = gameModule.netlistOf(mod);
    const layout = gameModule.levelizeNetlist(netlist);

    expect(netlist.latched).toContain('y');
    expect(netlist.nodes.some((node) => node.type === 'LATCH')).toBe(true);
    expect(Number.isFinite(layout.W) && Number.isFinite(layout.H)).toBe(true);
  });

  test('does not infer a latch when every path assigns the output', () => {
    const spec = iface('mux', [port('sel', 'in'), port('a', 'in'), port('b', 'in'), port('y', 'out')]);
    const mod = compile(`
      module mux(input sel, input a, input b, output reg y);
        always @(*) begin
          if (sel) y = a;
          else y = b;
        end
      endmodule
    `, spec);

    expect(gameModule.netlistOf(mod).latched).toEqual([]);
  });

  test('exports complete RTL artifacts whose module recompiles', () => {
    const challenge = gameModule.CODE_CHALLENGES.find((item) => item.solution && item.iface && item.test);
    const artifact = gameModule.exportRTL(challenge);

    expect(artifact.module).toContain(`module ${challenge.iface.name}`);
    expect(artifact.testbench).toContain(`module tb_${challenge.iface.name}`);
    expect(artifact.wrapper).toContain(`module tt_um_${challenge.iface.name}`);
    expect(vCompile(artifact.module, challenge.iface).ok).toBe(true);
  });

  test('maps data inputs beyond bit 7 onto the Tiny Tapeout uio input bank', () => {
    const challenge = gameModule.CODE_CHALLENGES.find((item) => item.id === 'c9');
    const wrapper = gameModule.exportRTL(challenge).wrapper;

    expect(wrapper).toContain('.a(ui_in[3:0])');
    expect(wrapper).toContain('.b(ui_in[7:4])');
    expect(wrapper).toContain('.op(uio_in[1:0])');
    expect(wrapper).not.toMatch(/ui_in\[(?:[89]|\d{2,})/);
  });

  test('routes output bits 9–16 through uio and rejects wider wrappers', () => {
    const challenge = gameModule.CODE_CHALLENGES.find((item) => item.id === 'm5');
    const wrapper = gameModule.exportRTL(challenge).wrapper;

    expect(wrapper).toContain('assign uo_out  = _tpo_out[7:0]');
    expect(wrapper).toContain("assign uio_out = {4'b0, _tpo_out[11:8]}");
    expect(wrapper).toContain("assign uio_oe  = {4'b0, 4'b1111}");
    expect(() => genTTWrapper('too_wide', [
      { n: 'a', d: 'in', w: 17 },
      { n: 'y', d: 'out', w: 1 },
    ])).toThrow(/at most 16 data input bits/);
  });
});

describe('flight recorder contract', () => {
  beforeAll(() => {
    shared.installDom();
    gameModule = shared.loadMod();
  });

  test('formats the complete diagnostic report without corrupt values', () => {
    const recorder = gameModule.FR;
    recorder.t0 = Date.now();
    recorder.cur = 'mine';
    recorder.curT = Date.now();
    recorder.path = ['menu(4s)'];
    recorder.evs = [
      { type: 'clear', id: 'm1', stars: 3 },
      { type: 'read', id: 'L3a' },
      { type: 'cfail', id: 'm2' },
      { type: 'cfail', id: 'm2' },
      { type: 'flatline' },
    ];
    recorder.notes = [{ where: 'mine', t: 2, text: 'gate felt unfair' }];
    recorder.fps = { mine: { n: 2, sum: 32, worst: 40, post: 1 } };
    recorder._f = 0;

    const report = recorder.report(
      { level: 4, xp: 320, scrap: 12 },
      { shadows: 'on', post: 'on' },
    );
    const lines = report.split('\n');

    expect(lines[0]).toBe('═══ TAPEOUT FLIGHT REPORT ═══');
    expect(lines.at(-1)).toBe('═══ end — paste this to Claude ═══');
    expect(report).toContain(gameModule.BUILD_TAG);
    expect(report).toContain('mine 63avg/25min·fx');
    expect(report).toContain('m1★3');
    expect(report).toContain('m2×2');
    expect(report).not.toMatch(/undefined|NaN|\[object Object\]/);
  });

  test('bounds telemetry buffers and tolerates missing save data', () => {
    const recorder = gameModule.FR;
    recorder.t0 = Date.now();
    recorder.cur = 'menu';
    recorder.curT = Date.now();
    recorder.path = [];
    recorder.evs = [];
    recorder.notes = [];
    recorder.fps = {};

    for (let i = 0; i < 600; i++) recorder.ev('tick', { i });
    for (let i = 0; i < 40; i++) {
      recorder.curT = Date.now() - 3000;
      recorder.enter(`screen-${i}`);
    }

    expect(recorder.evs.length).toBe(500);
    expect(recorder.path.length).toBe(30);
    expect(recorder.report(null, null)).not.toMatch(/undefined|NaN|\[object Object\]/);
  });
});
