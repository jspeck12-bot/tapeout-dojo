import { describe, expect, test } from 'vitest';
import {
  VSim,
  litValue,
  runCombTest,
  runSeqTest,
  vCompile,
  vTokenize,
} from '../src/engine/verilog.js';
import { levelizeNetlist, netlistOf } from '../src/engine/debug/netlist.js';
import {
  exportRTL,
  genCombTB,
  genTTWrapper,
} from '../src/engine/debug/rtl-export.js';

const port = (n, d, w = 1) => ({ n, d, w });
const iface = (name, ports) => ({ name, ports });

function expectOk(source, specification = null) {
  const result = vCompile(source, specification);
  expect(result.errors, JSON.stringify(result.errors)).toEqual([]);
  expect(result.ok).toBe(true);
  return result.mod;
}

function expectFail(source, specification, message) {
  const result = vCompile(source, specification);
  expect(result.ok).toBe(false);
  expect(result.errors.map((error) => error.msg).join('\n')).toContain(message);
  return result;
}

describe('tokenizer and literal edge cases', () => {
  test('tracks comment lines, signed markers, underscores, and normalized operators', () => {
    const tokens = vTokenize("// hi\n4'sb10_10 ^~ 4'b0001");
    expect(tokens[0]).toMatchObject({
      t: 'num',
      line: 2,
      v: { width: 4, base: 'b', digits: '10_10', signed: true },
    });
    expect(tokens.find((token) => token.t === 'op').v).toBe('~^');
    expect(() => litValue(tokens[0])).toThrow(/Signed literals aren't supported/);
  });

  test('rejects unclosed comments and unexpected characters', () => {
    expect(() => vTokenize('/* never')).toThrow(/Unclosed \/\* block comment/);
    expect(() => vTokenize('$')).toThrow(/Unexpected character '\$'/);
  });

  test('parses, masks, and validates each supported literal base', () => {
    const literal = (source) => litValue(vTokenize(source)[0]);
    expect(literal("4'b1010")).toEqual({ v: 10, w: 4 });
    expect(literal("8'h1_0")).toEqual({ v: 16, w: 8 });
    expect(literal("5'd33")).toEqual({ v: 1, w: 5 });
    expect(literal("4'o17")).toEqual({ v: 15, w: 4 });
    expect(literal('7')).toEqual({ v: 7, w: 32 });
    expect(() => literal("2'b2")).toThrow(/isn't valid in base 'b'/);
    expect(() => literal("33'h0")).toThrow(/width must be 1–32 bits/);
  });
});

describe('parser subset boundaries', () => {
  test('accepts classic port declarations', () => {
    expect(vCompile(`
      module m(a, b);
        input a;
        output b;
        assign b = a;
      endmodule
    `, null).ok).toBe(true);
  });

  test('rejects missing directions, inout, and signed declarations', () => {
    expectFail('module m(a); endmodule', null, "Port 'a' never got a direction");
    expectFail('module m(inout a); endmodule', null, "inout ports aren't supported");
    expectFail('module m(input signed a); endmodule', null, "'signed' isn't supported");
  });

  test('rejects procedural syntax in the wrong scope', () => {
    expectFail(`
      module m(input a, output reg y);
        always @(*) assign y = a;
      endmodule
    `, null, "'assign' doesn't go inside always blocks");
    expectFail(`
      module m(input a, output y);
        y = a;
      endmodule
    `, null, "Assignment to 'y' needs a home");
  });

  test('rejects instantiation, initial blocks, extra modules, and negedge', () => {
    expectFail(`
      module m(input a, output y);
        foo bar(.a(a));
      endmodule
    `, null, 'module instantiation');
    expectFail('module m(output reg q); initial q = 0; endmodule', null, "initial blocks aren't supported");
    expectFail(`
      module m(output y); assign y=1; endmodule
      module n(output y); assign y=0; endmodule
    `, null, 'Only one module per Dojo challenge');
    expectFail(`
      module m(input clk, input d, output reg q);
        always @(negedge clk) q <= d;
      endmodule
    `, null, "negedge isn't supported");
  });

  test('warns on manual sensitivity lists and rejects casez', () => {
    const specification = iface('m', [
      port('a', 'in'), port('b', 'in'), port('y', 'out'),
    ]);
    const result = vCompile(`
      module m(input a, input b, output reg y);
        always @(a or b) y = a;
      endmodule
    `, specification);
    expect(result.ok).toBe(true);
    expect(result.warnings[0].msg).toMatch(/Manual sensitivity lists go stale/);
    expectFail(`
      module m(input a, output reg y);
        always @(*) casez(a) 1'b0: y=0; default: y=1; endcase
      endmodule
    `, null, "casez isn't supported");
  });

  test('rejects unsupported ranges', () => {
    expectFail(
      'module m(output y); wire [3:1] x; assign y=0; endmodule',
      null,
      'Ranges must end at 0',
    );
    expectFail(
      'module m(output y); wire [0:3] x; assign y=0; endmodule',
      null,
      'Ranges must end at 0',
    );
  });
});

describe('operator precedence and widths', () => {
  test('uses Verilog precedence for arithmetic, shift, logical, and comparison operators', () => {
    const specification = iface('dut', [
      port('a', 'in', 4), port('b', 'in', 4), port('c', 'in', 4),
      port('sumShift', 'out', 4), port('logic', 'out'), port('compare', 'out'),
    ]);
    const mod = expectOk(`
      module dut(input [3:0] a, input [3:0] b, input [3:0] c,
                 output [3:0] sumShift, output logic, output compare);
        assign sumShift = a + b << 1;
        assign logic = (|a) && (|b) || (|c);
        assign compare = a < b == c[0];
      endmodule
    `, specification);
    expect(runCombTest(mod, [
      { in: { a: 1, b: 1, c: 0 }, out: { sumShift: 4, logic: 1, compare: 1 } },
      { in: { a: 3, b: 2, c: 0 }, out: { sumShift: 10, logic: 1, compare: 1 } },
    ]).pass).toBe(true);
  });

  test('evaluates nested ternaries right-associatively', () => {
    const specification = iface('dut', [
      port('a', 'in'), port('b', 'in'), port('c', 'in'),
      port('d', 'in'), port('e', 'in'), port('y', 'out'),
    ]);
    const mod = expectOk(`
      module dut(input a, input b, input c, input d, input e, output y);
        assign y = a ? b : c ? d : e;
      endmodule
    `, specification);
    expect(runCombTest(mod, [
      { in: { a: 0, b: 0, c: 1, d: 1, e: 0 }, out: { y: 1 } },
      { in: { a: 0, b: 1, c: 0, d: 1, e: 0 }, out: { y: 0 } },
      { in: { a: 1, b: 1, c: 0, d: 0, e: 0 }, out: { y: 1 } },
    ]).pass).toBe(true);
  });

  test('does not evaluate an unselected ternary branch', () => {
    const specification = iface('dut', [
      port('sel', 'in'), port('a', 'in', 4), port('y', 'out', 4),
    ]);
    const mod = expectOk(`
      module dut(input sel, input [3:0] a, output [3:0] y);
        assign y = sel ? a : (a / 4'd0);
      endmodule
    `, specification);
    expect(runCombTest(mod, [
      { in: { sel: 1, a: 3 }, out: { y: 3 } },
    ]).pass).toBe(true);
  });

  test('tokenizes power but rejects it as unsupported syntax', () => {
    expectFail(`
      module dut(input a, input b, output y);
        assign y = a ** b;
      endmodule
    `, iface('dut', [port('a', 'in'), port('b', 'in'), port('y', 'out')]),
    "Expected ';' to end the assign");
  });

  test('truncates arithmetic on assignment and preserves concat carry', () => {
    const sum = expectOk(`
      module dut(input [3:0] a, input [3:0] b, output [3:0] y);
        assign y = a + b;
      endmodule
    `, iface('dut', [port('a', 'in', 4), port('b', 'in', 4), port('y', 'out', 4)]));
    expect(runCombTest(sum, [
      { in: { a: 15, b: 1 }, out: { y: 0 } },
      { in: { a: 0, b: 1 }, out: { y: 1 } },
    ]).pass).toBe(true);

    const carry = expectOk(`
      module dut(input [3:0] a, input [3:0] b, output [3:0] sum, output cout);
        assign {cout, sum} = a + b;
      endmodule
    `, iface('dut', [
      port('a', 'in', 4), port('b', 'in', 4),
      port('sum', 'out', 4), port('cout', 'out'),
    ]));
    expect(runCombTest(carry, [
      { in: { a: 8, b: 8 }, out: { sum: 0, cout: 1 } },
    ]).pass).toBe(true);
  });

  test('handles replication, OOB reads, and runtime-invalid selects', () => {
    const replicate = expectOk(`
      module dut(input a, output [3:0] y);
        assign y = {4{a}};
      endmodule
    `, iface('dut', [port('a', 'in'), port('y', 'out', 4)]));
    expect(runCombTest(replicate, [
      { in: { a: 1 }, out: { y: 15 } },
    ]).pass).toBe(true);

    const oob = expectOk(`
      module dut(input [7:0] a, output y);
        assign y = a[8];
      endmodule
    `, iface('dut', [port('a', 'in', 8), port('y', 'out')]));
    expect(runCombTest(oob, [
      { in: { a: 255 }, out: { y: 0 } },
    ]).pass).toBe(true);

    const backwards = expectOk(`
      module dut(input [7:0] a, output [3:0] y);
        assign y = a[2:5];
      endmodule
    `, iface('dut', [port('a', 'in', 8), port('y', 'out', 4)]));
    expect(runCombTest(backwards, [
      { in: { a: 0 }, out: { y: 0 } },
    ]).runtimeError.msg).toMatch(/Part-select \[2:5\].*backwards/);
  });

  test('resolves localparams in widths and comparisons', () => {
    const mod = expectOk(`
      module dut(input [1:0] state, output [3:0] y, output on_out);
        localparam W = 3, ON = 1;
        wire [W:0] x;
        assign x = 4'b1010;
        assign y = x;
        assign on_out = (state == ON);
      endmodule
    `, iface('dut', [
      port('state', 'in', 2), port('y', 'out', 4), port('on_out', 'out'),
    ]));
    expect(runCombTest(mod, [
      { in: { state: 1 }, out: { y: 10, on_out: 1 } },
      { in: { state: 0 }, out: { y: 10, on_out: 0 } },
    ]).pass).toBe(true);
  });
});

describe('semantic checks', () => {
  test('rejects wrong procedural assignment styles', () => {
    const specification = iface('dut', [
      port('clk', 'in'), port('a', 'in'), port('y', 'out'),
    ]);
    expectFail(`
      module dut(input clk, input a, output reg y);
        always @(posedge clk) y = a;
      endmodule
    `, specification, "Blocking '=' inside a clocked always block");
    expectFail(`
      module dut(input clk, input a, output reg y);
        always @(*) y <= a;
      endmodule
    `, specification, "Non-blocking '<=' inside always @(*)");
  });

  test('rejects multiple drivers and undriven outputs', () => {
    const specification = iface('dut', [
      port('a', 'in'), port('b', 'in'), port('y', 'out'),
    ]);
    expectFail(`
      module dut(input a, input b, output y);
        assign y = a;
        assign y = b;
      endmodule
    `, specification, "'y' has multiple assign drivers");
    expectFail('module dut(input a, input b, output y); endmodule',
      specification, "Output 'y' is never driven");
  });

  test('enforces wire/reg driver ownership and parameter immutability', () => {
    expectFail(`
      module dut(input a, output reg y);
        assign y = a;
      endmodule
    `, iface('dut', [port('a', 'in'), port('y', 'out')]),
    "'y' is a reg, so 'assign' can't drive it");
    expectFail(`
      module dut(input a, output y);
        always @(*) y = a;
      endmodule
    `, iface('dut', [port('a', 'in'), port('y', 'out')]),
    "'y' is a wire");
    expectFail(`
      module dut(output y);
        parameter P = 1;
        assign P = 0;
        assign y = 1;
      endmodule
    `, iface('dut', [port('y', 'out')]),
    "'P' is a parameter");
  });

  test('supports disjoint part-select continuous drivers', () => {
    const specification = iface('dut', [
      port('a', 'in'), port('b', 'in'), port('y', 'out', 2),
    ]);
    const mod = expectOk(`
      module dut(input a, input b, output [1:0] y);
        assign y[1] = a;
        assign y[0] = b;
      endmodule
    `, specification);
    expect(runCombTest(mod, [
      { in: { a: 1, b: 0 }, out: { y: 2 } },
      { in: { a: 0, b: 1 }, out: { y: 1 } },
    ]).pass).toBe(true);
  });
});

describe('sequential event semantics', () => {
  test('handles reset, enable hold, and counter wrap', () => {
    const specification = iface('dut', [
      port('clk', 'in'), port('rst', 'in'), port('en', 'in'),
      port('d', 'in', 4), port('q', 'out', 4),
    ]);
    const mod = expectOk(`
      module dut(input clk, input rst, input en, input [3:0] d, output reg [3:0] q);
        always @(posedge clk) begin
          if (rst) q <= 4'd0;
          else if (en) q <= d;
          else q <= q + 1;
        end
      endmodule
    `, specification);
    const frames = [
      { rst: 1, en: 0, d: 9 },
      { rst: 0, en: 1, d: 14 },
      { rst: 0, en: 0, d: 0 },
      { rst: 0, en: 0, d: 0 },
    ];
    const result = runSeqTest(mod, frames, () => {
      let q = 0;
      return {
        step(frame) {
          if (frame.rst) q = 0;
          else if (frame.en) q = frame.d;
          else q = (q + 1) & 15;
          return { q };
        },
      };
    }, ['q']);
    expect(result.pass).toBe(true);
    expect(result.trace.map((row) => row.got.q)).toEqual([0, 14, 15, 0]);
  });

  test('uses old values for NBA sampling and lets the last NBA win', () => {
    const specification = iface('dut', [
      port('clk', 'in'), port('d', 'in'), port('e', 'in'),
      port('q', 'out'), port('y', 'out'),
    ]);
    const mod = expectOk(`
      module dut(input clk, input d, input e, output reg q, output reg y);
        always @(posedge clk) begin
          q <= d;
          y <= q;
          q <= e;
        end
      endmodule
    `, specification);
    const sim = new VSim(mod);
    sim.setInput('d', 1);
    sim.setInput('e', 0);
    sim.clock();
    expect(sim.get('q')).toBe(0);
    expect(sim.get('y')).toBe(0);
    sim.setInput('d', 0);
    sim.setInput('e', 1);
    sim.clock();
    expect(sim.get('q')).toBe(1);
    expect(sim.get('y')).toBe(0);
  });

  test('reports an out-of-range sequential write at runtime', () => {
    const mod = expectOk(`
      module dut(input clk, input d, output reg [3:0] q);
        always @(posedge clk) q[4] <= d;
      endmodule
    `, iface('dut', [
      port('clk', 'in'), port('d', 'in'), port('q', 'out', 4),
    ]));
    const result = runSeqTest(mod, [{ d: 1 }], () => ({
      step: () => ({ q: 0 }),
    }), ['q']);
    expect(result.runtimeError.msg).toMatch(/Bit 4 doesn't exist/);
  });
});

describe('latch and netlist contracts', () => {
  test('models incomplete combinational assignment as held state and a latch', () => {
    const mod = expectOk(`
      module dut(input en, input a, output reg y);
        always @(*) if (en) y = a;
      endmodule
    `, iface('dut', [port('en', 'in'), port('a', 'in'), port('y', 'out')]));
    const sim = new VSim(mod);
    sim.setInput('en', 1);
    sim.setInput('a', 1);
    sim.settle();
    sim.setInput('en', 0);
    sim.setInput('a', 0);
    sim.settle();
    expect(sim.get('y')).toBe(1);
    const netlist = netlistOf(mod);
    expect(netlist.latched).toEqual(['y']);
    expect(netlist.nodes.some((node) => node.type === 'LATCH')).toBe(true);
    expect(Number.isFinite(levelizeNetlist(netlist).W)).toBe(true);
  });

  test('uses deterministic primitive node and mux pin ordering', () => {
    const andMod = expectOk(`
      module dut(input a, input b, output y);
        assign y = a & b;
      endmodule
    `, iface('dut', [port('a', 'in'), port('b', 'in'), port('y', 'out')]));
    expect(netlistOf(andMod).nodes.map((node) => node.type))
      .toEqual(['IN', 'IN', 'AND', 'OUT']);

    const muxMod = expectOk(`
      module dut(input a, input b, input sel, output y);
        assign y = sel ? a : b;
      endmodule
    `, iface('dut', [
      port('a', 'in'), port('b', 'in'), port('sel', 'in'), port('y', 'out'),
    ]));
    const netlist = netlistOf(muxMod);
    const mux = netlist.nodes.find((node) => node.type === 'MUX');
    expect(mux.ins.map((id) => netlist.nodes[id].label)).toEqual(['a', 'b', 'sel']);
  });
});

describe('RTL export details', () => {
  test('emits exact expected-zero checks and synchronous sampling', () => {
    const comb = genCombTB('and_gate', [
      port('a', 'in'), port('b', 'in'), port('y', 'out'),
    ], [{ in: { a: 0, b: 0 }, out: { y: 0 } }]);
    expect(comb).toContain("a = 1'd0; b = 1'd0; #1;");
    expect(comb).toContain("if (y !== 1'd0)");

    const sequential = exportRTL({
      iface: { name: 'dff', ports: [port('clk', 'in'), port('d', 'in'), port('q', 'out')] },
      solution: 'module dff(input clk,input d,output reg q); always @(posedge clk) q <= d; endmodule',
      test: {
        type: 'seq',
        watch: ['q'],
        frames: [{ d: 1 }],
        makeRef: () => ({ step: (frame) => ({ q: frame.d }) }),
      },
    });
    expect(sequential.testbench).toContain('always #5 clk = ~clk;');
    expect(sequential.testbench).toContain('@(posedge clk); #1;');
  });

  test('maps clock/reset separately from Tiny Tapeout data pins', () => {
    const wrapper = genTTWrapper('dff_rst', [
      port('clk', 'in'), port('rst', 'in'), port('d', 'in'), port('q', 'out'),
    ]);
    expect(wrapper).toContain('.clk(clk)');
    expect(wrapper).toContain('.rst(~rst_n)');
    expect(wrapper).toContain('.d(ui_in[0])');
  });
});

describe('audited compiler regressions', () => {
  test('preserves parameter widths and truncates declared parameter ranges', () => {
    const narrow = expectOk(`
      module dut(output [1:0] y);
        localparam P = 1'b1;
        assign y = {P, P};
      endmodule
    `, iface('dut', [port('y', 'out', 2)]));
    expect(runCombTest(narrow, [{ in: {}, out: { y: 3 } }]).pass).toBe(true);

    const ranged = expectOk(`
      module dut(output y);
        parameter [3:0] P = 5'd31;
        assign y = (P == 5'd31);
      endmodule
    `, iface('dut', [port('y', 'out')]));
    expect(runCombTest(ranged, [{ in: {}, out: { y: 0 } }]).pass).toBe(true);
  });

  test('keeps low 32 bits exact for large literals, multiplication, and shifts', () => {
    const mod = expectOk(`
      module dut(output [31:0] product, output [31:0] literal, output [31:0] shifted);
        assign product = 32'hffffffff * 32'hffffffff;
        assign literal = 32'h20000000000001;
        assign shifted = 32'hffffffff << 31;
      endmodule
    `, iface('dut', [
      port('product', 'out', 32), port('literal', 'out', 32), port('shifted', 'out', 32),
    ]));
    expect(runCombTest(mod, [{
      in: {},
      out: { product: 1, literal: 1, shifted: 0x80000000 },
    }]).pass).toBe(true);
  });

  test('rejects signed literals in the deliberately unsigned subset', () => {
    const result = vCompile(`
      module dut(output [3:0] y);
        assign y = 4'shf;
      endmodule
    `, iface('dut', [port('y', 'out', 4)]));
    expect(result.ok).toBe(false);
    expect(result.errors[0].msg).toMatch(/Signed literals aren't supported/);
  });

  test('requires constant replication counts and fixed part-select bounds', () => {
    expectFail(`
      module dut(input [1:0] n, input a, output [3:0] y);
        assign y = {n{a}};
      endmodule
    `, iface('dut', [port('n', 'in', 2), port('a', 'in'), port('y', 'out', 4)]),
    "'n' isn't a constant");
    expectFail(`
      module dut(input [7:0] a, input [2:0] hi, output [3:0] y);
        assign y = a[hi:0];
      endmodule
    `, iface('dut', [port('a', 'in', 8), port('hi', 'in', 3), port('y', 'out', 4)]),
    "'hi' isn't a constant");
  });

  test('captures indexed nonblocking targets before committing other NBAs', () => {
    const mod = expectOk(`
      module dut(input clk, input d, output reg idx, output reg [1:0] q);
        always @(posedge clk) begin
          idx <= idx + 1;
          q[idx] <= d;
        end
      endmodule
    `, iface('dut', [
      port('clk', 'in'), port('d', 'in'), port('idx', 'out'), port('q', 'out', 2),
    ]));
    const sim = new VSim(mod);
    sim.setInput('d', 1);
    sim.clock();
    expect(sim.get('idx')).toBe(1);
    expect(sim.get('q')).toBe(1);
  });

  test('rejects asynchronous sensitivity events the simulator cannot execute', () => {
    expectFail(`
      module dut(input clk, input rst, input d, output reg q);
        always @(posedge clk or posedge rst) begin
          if (rst) q <= 0; else q <= d;
        end
      endmodule
    `, iface('dut', [
      port('clk', 'in'), port('rst', 'in'), port('d', 'in'), port('q', 'out'),
    ]), "Asynchronous sensitivity events aren't supported");
  });

  test('does not let latchy logic pass a stateless truth-table specification', () => {
    const mod = expectOk(`
      module dut(input en, input d, output reg y);
        always @(*) if (en) y = d;
      endmodule
    `, iface('dut', [port('en', 'in'), port('d', 'in'), port('y', 'out')]));
    const result = runCombTest(mod, [
      { in: { en: 0, d: 1 }, out: { y: 0 } },
      { in: { en: 1, d: 1 }, out: { y: 1 } },
      { in: { en: 0, d: 0 }, out: { y: 0 } },
    ]);
    expect(result.pass).toBe(false);
    expect(result.rows.at(-1).got.y).toBe(1);
  });
});

describe('audited netlist equivalence regressions', () => {
  test('preserves blocking assignment order between procedural outputs', () => {
    const mod = expectOk(`
      module dut(input a, input b, output reg y, output reg z);
        always @(*) begin
          y = a;
          z = y;
          y = b;
        end
      endmodule
    `, iface('dut', [
      port('a', 'in'), port('b', 'in'), port('y', 'out'), port('z', 'out'),
    ]));
    const netlist = netlistOf(mod);
    const output = netlist.nodes.find((node) => node.type === 'OUT' && node.label === 'z');
    const driver = netlist.nodes[output.ins[0]];
    expect(driver.label).toBe('a');
  });

  test('marks partial procedural holds as latches and exhaustive cases as combinational', () => {
    const partial = expectOk(`
      module dut(input en, input d, output reg [1:0] y);
        always @(*) if (en) y[0] = d;
      endmodule
    `, iface('dut', [port('en', 'in'), port('d', 'in'), port('y', 'out', 2)]));
    expect(netlistOf(partial).latched).toEqual(['y']);

    const exhaustive = expectOk(`
      module dut(input sel, input a, input b, output reg y);
        always @(*) case (sel)
          1'b0: y = a;
          1'b1: y = b;
        endcase
      endmodule
    `, iface('dut', [
      port('sel', 'in'), port('a', 'in'), port('b', 'in'), port('y', 'out'),
    ]));
    expect(netlistOf(exhaustive).latched).toEqual([]);
  });

  test('represents parameter constants, dynamic indices, and operator widths', () => {
    const mod = expectOk(`
      module dut(input [3:0] a, input [1:0] idx, input b,
                 output bit_out, output [3:0] repeated,
                 output logic_out, output [3:0] product, output param_out);
        localparam P = 1'b1;
        assign bit_out = a[idx];
        assign repeated = {4{b}};
        assign logic_out = a && repeated;
        assign product = a[1:0] * repeated[1:0];
        assign param_out = P;
      endmodule
    `, iface('dut', [
      port('a', 'in', 4), port('idx', 'in', 2), port('b', 'in'),
      port('bit_out', 'out'), port('repeated', 'out', 4),
      port('logic_out', 'out'), port('product', 'out', 4), port('param_out', 'out'),
    ]));
    const netlist = netlistOf(mod);
    const slice = netlist.nodes.find((node) => node.type === 'SLICE' && node.label === '[·]');
    expect(slice.ins.map((id) => netlist.nodes[id].label)).toContain('idx');
    expect(netlist.nodes.find((node) => node.type === 'REPL').w).toBe(4);
    expect(netlist.nodes.find((node) => node.label === '&&').w).toBe(1);
    expect(netlist.nodes.find((node) => node.type === 'MUL').w).toBe(4);
    expect(netlist.nodes.some((node) => node.type === 'CONST' && node.label === '1')).toBe(true);
  });

  test('keeps all dependencies for disjoint partial continuous drivers', () => {
    const mod = expectOk(`
      module dut(input a, input b, output [1:0] y);
        assign y[1] = a;
        assign y[0] = b;
      endmodule
    `, iface('dut', [port('a', 'in'), port('b', 'in'), port('y', 'out', 2)]));
    const netlist = netlistOf(mod);
    const proc = netlist.nodes.find((node) => node.type === 'PROC');
    expect(proc.ins.map((id) => netlist.nodes[id].label).sort()).toEqual(['a', 'b']);
  });
});
