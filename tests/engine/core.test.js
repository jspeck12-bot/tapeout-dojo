import { describe, expect, test } from 'vitest';
import {
  vCompile, vTokenize, runCombTest, runSeqTest, VSim,
} from '../../src/engine/core.js';
import { netlistOf, levelizeNetlist } from '../../src/engine/netlist.js';
import { handleEngineRequest } from '../../src/engine/protocol.js';
import { createFallbackClient, createMainThreadClient } from '../../src/engine/client.js';

const port = (n, d, w = 1) => ({ n, d, w });
const iface = (name, ports) => ({ name, ports });

function compile(source, spec) {
  const result = vCompile(source, spec);
  expect(result.ok, (result.errors || []).map((e) => e.msg).join('\n')).toBe(true);
  return result.mod;
}

describe('tokenizer and parser', () => {
  test('tokenizes comments, keywords, identifiers, sized literals, and ===', () => {
    const tokens = vTokenize(`
      // line comment
      module demo(input [3:0] a, output y);
        /* block comment */ assign y = &a | 1'b0;
        wire eq = a === 4'b0;
      endmodule
    `);
    expect(tokens.some((t) => t.t === 'kw' && t.v === 'module')).toBe(true);
    expect(tokens.some((t) => t.t === 'id' && t.v === 'demo')).toBe(true);
    expect(tokens.some((t) => t.t === 'op' && t.v === '===')).toBe(true);
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

  test('parses four-state literals', () => {
    const result = vCompile(
      "module m(output y, output [3:0] bus); assign y = 1'bx; assign bus = 4'bz1x0; endmodule",
      iface('m', [port('y', 'out'), port('bus', 'out', 4)]),
    );
    expect(result.ok, (result.errors || []).map((e) => e.msg).join('\n')).toBe(true);
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

describe('expressions, width, blocking vs NBA', () => {
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
    const result = runSeqTest(mod, frames, () => ({ step() { return { q: 0, r: 0 }; } }), ['q', 'r']);
    // q captures d; r captures old q. r powers up X, so cycle 0's r is X not 0.
    expect(result.trace[0].got.q.v).toBe(1);
    expect(result.trace[0].got.r.xz).toBeTruthy();
    expect(result.trace[1].got.q.v).toBe(0);
    expect(result.trace[1].got.r.v).toBe(1);
    expect(result.trace[1].got.r.xz).toBeFalsy();
    expect(result.trace[2].got.q.v).toBe(1);
    expect(result.trace[2].got.r.v).toBe(0);
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
});

describe('combinational loops and latches', () => {
  test('names the signals in a combinational loop as a design error', () => {
    const spec = iface('loop', [port('a', 'in'), port('y', 'out')]);
    const mod = compile('module loop(input a, output y); assign y = ~y; endmodule', spec);
    let err = null;
    try { new VSim(mod).settle(); } catch (e) { err = e; }
    expect(err).toBeTruthy();
    expect(err.code).toBe('COMBINATIONAL_LOOP');
    expect(err.signals).toContain('y');
    const t0 = Date.now();
    try { new VSim(mod).settle(); } catch (e) { /* expected */ }
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  test('marks an uncovered combinational path as a latch', () => {
    const spec = iface('latchy', [port('en', 'in'), port('d', 'in'), port('y', 'out')]);
    const mod = compile(`
      module latchy(input en, input d, output reg y);
        always @(*) if (en) y = d;
      endmodule
    `, spec);
    const netlist = netlistOf(mod);
    const layout = levelizeNetlist(netlist);
    expect(netlist.latched).toContain('y');
    expect(netlist.nodes.some((node) => node.type === 'LATCH')).toBe(true);
    expect(Number.isFinite(layout.W) && Number.isFinite(layout.H)).toBe(true);
  });
});

describe('worker protocol and fallback', () => {
  test('handleEngineRequest is synchronous and echoes request id', () => {
    const msg = handleEngineRequest({
      id: 42,
      op: 'compile',
      payload: {
        src: 'module and_gate(input a, input b, output y); assign y = a & b; endmodule',
        iface: iface('and_gate', [port('a', 'in'), port('b', 'in'), port('y', 'out')]),
      },
    });
    expect(msg.id).toBe(42);
    expect(msg.ok).toBe(true);
    expect(msg.result.mod).toBeTruthy();
  });

  test('main-thread fallback compiles and a later request supersedes by id', async () => {
    const fb = createFallbackClient();
    expect(fb.kind).toBe('main');
    const a = await fb.request('compile', {
      src: 'module m(output y); assign y = 1; endmodule',
      iface: iface('m', [port('y', 'out')]),
    });
    const b = await fb.request('compile', {
      src: 'module m(output y); assign y = 0; endmodule',
      iface: iface('m', [port('y', 'out')]),
    });
    expect(a.ok && b.ok).toBe(true);
    expect(a.id).not.toBe(b.id);

    const main = createMainThreadClient();
    main.cancel();
    const c = await main.request('runTest', {
      src: 'module m(output y); assign y = 1; endmodule',
      iface: iface('m', [port('y', 'out')]),
      test: { type: 'comb', vectors: [{ in: {}, out: { y: 1 } }] },
    });
    expect(c.ok && c.result.test.pass).toBe(true);
  });

  test('Worker-unavailable path is the main-thread client', () => {
    const fb = createFallbackClient();
    expect(fb.kind).toBe('main');
    expect(createMainThreadClient().kind).toBe('main');
  });
});
