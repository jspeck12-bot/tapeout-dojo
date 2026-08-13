import { combVecs } from './util.js';

const REMIX = {};
function defRemix(id, v) { REMIX[id] = v; }

defRemix('m1', {
  title: 'First Contact · NOR Strain', xp: 40,
  brief: "The remix inverts the world. Drive `y` as the NOR of `a` and `b` — OR, then inverted. Same wiring discipline, opposite gate.",
  iface: { name: 'nor_gate', ports: [{ n: 'a', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 1 }] },
  solution: "module nor_gate(input a, input b, output y);\n  assign y = ~(a | b);\nendmodule\n",
  test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 1 }, { n: 'b', w: 1 }], (i) => ({ y: (i.a | i.b) ^ 1 })) }
});
defRemix('m2', {
  title: 'Universal NAND · Equality Strain', xp: 40,
  brief: "Build XNOR: `y` is 1 exactly when `a` and `b` match. The equality gate — compose it from operators you already own.",
  iface: { name: 'xnor_gate', ports: [{ n: 'a', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 1 }] },
  solution: "module xnor_gate(input a, input b, output y);\n  assign y = ~(a ^ b);\nendmodule\n",
  test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 1 }, { n: 'b', w: 1 }], (i) => ({ y: (i.a ^ i.b) ^ 1 })) }
});
defRemix('m3', {
  title: 'Half Adder · Subtractor Strain', xp: 45,
  brief: "A half subtractor computes `a − b` on single bits: `diff` is the result bit, `borrow` fires only on 0 − 1. One of these outputs you've built before; the other needs exactly one inversion.",
  iface: { name: 'half_sub', ports: [{ n: 'a', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 1 }, { n: 'diff', d: 'out', w: 1 }, { n: 'borrow', d: 'out', w: 1 }] },
  solution: "module half_sub(input a, input b, output diff, output borrow);\n  assign diff   = a ^ b;\n  assign borrow = ~a & b;\nendmodule\n",
  test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 1 }, { n: 'b', w: 1 }], (i) => ({ diff: i.a ^ i.b, borrow: (i.a ^ 1) & i.b })) }
});
defRemix('m4', {
  title: 'Majority Rules · Parity Strain', xp: 45,
  brief: "Odd-parity detector: `y` is 1 when an odd number of `a`, `b`, `c` are 1. This is the error-detection primitive in every memory system ever shipped.",
  iface: { name: 'parity3', ports: [{ n: 'a', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 1 }, { n: 'c', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 1 }] },
  solution: "module parity3(input a, input b, input c, output y);\n  assign y = a ^ b ^ c;\nendmodule\n",
  test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 1 }, { n: 'b', w: 1 }, { n: 'c', w: 1 }], (i) => ({ y: i.a ^ i.b ^ i.c })) }
});
defRemix('m5', {
  title: 'Bus Work · Inverted Strain', xp: 45,
  brief: "Same buses, inverted gates: produce 4-bit NAND, NOR, and XNOR of `a` and `b`, lane by lane.",
  iface: { name: 'bus_inv', ports: [{ n: 'a', d: 'in', w: 4 }, { n: 'b', d: 'in', w: 4 }, { n: 'y_nand', d: 'out', w: 4 }, { n: 'y_nor', d: 'out', w: 4 }, { n: 'y_xnor', d: 'out', w: 4 }] },
  solution: "module bus_inv(input [3:0] a, input [3:0] b, output [3:0] y_nand, output [3:0] y_nor, output [3:0] y_xnor);\n  assign y_nand = ~(a & b);\n  assign y_nor  = ~(a | b);\n  assign y_xnor = ~(a ^ b);\nendmodule\n",
  test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 4 }, { n: 'b', w: 4 }], (i) => ({ y_nand: 15 & ~(i.a & i.b), y_nor: 15 & ~(i.a | i.b), y_xnor: 15 & ~(i.a ^ i.b) })) }
});
defRemix('m6', {
  title: 'Nibble Swap · Rotate Strain', xp: 45,
  brief: "Rotate the byte left by one: every bit shifts up a position and the old MSB wraps around to bit 0. `0x81` becomes `0x03`. Pure concatenation.",
  iface: { name: 'rotl1', ports: [{ n: 'in_byte', d: 'in', w: 8 }, { n: 'out_byte', d: 'out', w: 8 }] },
  solution: "module rotl1(input [7:0] in_byte, output [7:0] out_byte);\n  assign out_byte = {in_byte[6:0], in_byte[7]};\nendmodule\n",
  test: { type: 'comb', vectors: combVecs([{ n: 'in_byte', w: 8 }], (i) => ({ out_byte: ((i.in_byte << 1) & 255) | (i.in_byte >> 7) })) }
});
defRemix('c1', {
  title: '2:1 Mux · Inverted Select', xp: 50,
  brief: "Active-low select: when `sel` is 0, `y` follows `a`; when `sel` is 1, it follows `b`. Read the spec twice — the remix lives in the details.",
  iface: { name: 'mux2n', ports: [{ n: 'a', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 1 }, { n: 'sel', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 1 }] },
  solution: "module mux2n(input a, input b, input sel, output y);\n  assign y = sel ? b : a;\nendmodule\n",
  test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 1 }, { n: 'b', w: 1 }, { n: 'sel', w: 1 }], (i) => ({ y: i.sel ? i.b : i.a })) }
});
defRemix('c2', {
  title: '4:1 Mux · Gated Strain', xp: 50,
  brief: "Same 4:1 mux, plus an enable: while `en` is 1, `y` = the selected input; when `en` drops, `y` is forced to 0 regardless of `sel`.",
  iface: { name: 'mux4e', ports: [{ n: 'd0', d: 'in', w: 1 }, { n: 'd1', d: 'in', w: 1 }, { n: 'd2', d: 'in', w: 1 }, { n: 'd3', d: 'in', w: 1 }, { n: 'sel', d: 'in', w: 2 }, { n: 'en', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 1 }] },
  solution: "module mux4e(input d0, input d1, input d2, input d3, input [1:0] sel, input en, output y);\n  assign y = en & (sel[1] ? (sel[0] ? d3 : d2) : (sel[0] ? d1 : d0));\nendmodule\n",
  test: { type: 'comb', vectors: combVecs([{ n: 'd0', w: 1 }, { n: 'd1', w: 1 }, { n: 'd2', w: 1 }, { n: 'd3', w: 1 }, { n: 'sel', w: 2 }, { n: 'en', w: 1 }], (i) => ({ y: i.en ? [i.d0, i.d1, i.d2, i.d3][i.sel] : 0 })) }
});
defRemix('c3', {
  title: 'Full Adder · Full Subtractor', xp: 50,
  brief: "Full subtractor: `diff` = a − b − bin (the result bit), `bout` fires when the column must borrow. `diff` is the same XOR chain as addition; `bout` = `(~a & b) | (bin & ~(a ^ b))`.",
  iface: { name: 'full_sub', ports: [{ n: 'a', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 1 }, { n: 'bin', d: 'in', w: 1 }, { n: 'diff', d: 'out', w: 1 }, { n: 'bout', d: 'out', w: 1 }] },
  solution: "module full_sub(input a, input b, input bin, output diff, output bout);\n  assign diff = a ^ b ^ bin;\n  assign bout = (~a & b) | (bin & ~(a ^ b));\nendmodule\n",
  test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 1 }, { n: 'b', w: 1 }, { n: 'bin', w: 1 }], (i) => { const t = i.a - i.b - i.bin; return { diff: ((t % 2) + 2) % 2, bout: t < 0 ? 1 : 0 }; }) }
});
defRemix('c4', {
  title: '4-Bit Adder · Subtractor Strain', xp: 55,
  brief: "4-bit subtraction: `diff` = a − b (wrapping at 4 bits — the odometer runs backwards), and `bout` = 1 when a borrow happened, i.e. when `a < b`.",
  iface: { name: 'sub4', ports: [{ n: 'a', d: 'in', w: 4 }, { n: 'b', d: 'in', w: 4 }, { n: 'diff', d: 'out', w: 4 }, { n: 'bout', d: 'out', w: 1 }] },
  solution: "module sub4(input [3:0] a, input [3:0] b, output [3:0] diff, output bout);\n  assign diff = a - b;\n  assign bout = a < b;\nendmodule\n",
  test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 4 }, { n: 'b', w: 4 }], (i) => ({ diff: ((i.a - i.b) % 16 + 16) % 16, bout: i.a < i.b ? 1 : 0 })) }
});
defRemix('c5', {
  title: '2:4 Decoder · One-Cold Strain', xp: 55,
  brief: "Active-low decoding: while `en` is 1, exactly one bit of `y` is LOW (the selected one) and the rest are HIGH. When `en` is 0, all four lines idle HIGH. This is how real chip-select lines actually work.",
  iface: { name: 'dec24n', ports: [{ n: 'a', d: 'in', w: 2 }, { n: 'en', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 4 }] },
  solution: "module dec24n(input [1:0] a, input en, output [3:0] y);\n  assign y = en ? ~(4'b0001 << a) : 4'b1111;\nendmodule\n",
  test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 2 }, { n: 'en', w: 1 }], (i) => ({ y: i.en ? (15 & ~(1 << i.a)) : 15 })) }
});
defRemix('c6', {
  title: 'Absolute Value · Sign Extend', xp: 55,
  brief: "Sign extension: stretch a 4-bit two's-complement number into 8 bits without changing its value. The rule: copy the sign bit `a[3]` into all four new upper positions. Replication `{4{bit}}` makes it one line.",
  iface: { name: 'sext48', ports: [{ n: 'a', d: 'in', w: 4 }, { n: 'y', d: 'out', w: 8 }] },
  solution: "module sext48(input [3:0] a, output [7:0] y);\n  assign y = {{4{a[3]}}, a};\nendmodule\n",
  test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 4 }], (i) => ({ y: i.a >= 8 ? 240 + i.a : i.a })) }
});
defRemix('c7', {
  title: 'BOSS · Priority Encoder · Trailing Strain', xp: 80, boss: true,
  brief: "Inverted priority: now the LOWEST set bit wins. `pos` = index of the lowest 1 in `in_req`; `valid` = 1 if anything is set; `pos` = 0 when nothing is. Same ternary chain, opposite scan direction — bit 0 gets checked first.",
  iface: { name: 'prio_lo', ports: [{ n: 'in_req', d: 'in', w: 4 }, { n: 'pos', d: 'out', w: 2 }, { n: 'valid', d: 'out', w: 1 }] },
  solution: "module prio_lo(input [3:0] in_req, output [1:0] pos, output valid);\n  assign pos = in_req[0] ? 2'd0 :\n               in_req[1] ? 2'd1 :\n               in_req[2] ? 2'd2 :\n               in_req[3] ? 2'd3 : 2'd0;\n  assign valid = |in_req;\nendmodule\n",
  test: { type: 'comb', vectors: combVecs([{ n: 'in_req', w: 4 }], (i) => ({ pos: i.in_req & 1 ? 0 : i.in_req & 2 ? 1 : i.in_req & 4 ? 2 : i.in_req & 8 ? 3 : 0, valid: i.in_req ? 1 : 0 })) }
});
defRemix('s1', {
  title: 'The D Flip-Flop · Twin Strain', xp: 50,
  brief: "A DFF with complementary outputs, like the real 7474 part: `q` captures `d` on the edge, and `qn` is always the inverse of `q`. One clocked block plus one continuous assign.",
  iface: { name: 'dff2', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'd', d: 'in', w: 1 }, { n: 'q', d: 'out', w: 1 }, { n: 'qn', d: 'out', w: 1 }] },
  solution: "module dff2(input clk, input d, output reg q, output qn);\n  always @(posedge clk) q <= d;\n  assign qn = ~q;\nendmodule\n",
  test: {
    type: 'seq', watch: ['q', 'qn'],
    frames: [{ d: 1 }, { d: 0 }, { d: 1 }, { d: 1 }, { d: 0 }, { d: 0 }, { d: 1 }, { d: 0 }],
    makeRef: () => ({ q: 0, step(f) { this.q = f.d; return { q: this.q, qn: this.q ^ 1 }; } })
  }
});
defRemix('s2', {
  title: 'Reset Protocol · Preset Strain', xp: 50,
  brief: "Same register, opposite reset: when `rst` is 1 on the edge, `q` goes to **1** (a preset, not a clear). Otherwise capture `d`. Reset values are a design choice — this is the other choice.",
  iface: { name: 'dff_pre', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'd', d: 'in', w: 1 }, { n: 'q', d: 'out', w: 1 }] },
  solution: "module dff_pre(input clk, input rst, input d, output reg q);\n  always @(posedge clk) begin\n    if (rst) q <= 1'b1;\n    else     q <= d;\n  end\nendmodule\n",
  test: {
    type: 'seq', watch: ['q'],
    frames: [{ rst: 1, d: 0 }, { rst: 0, d: 0 }, { rst: 0, d: 1 }, { rst: 0, d: 0 }, { rst: 1, d: 0 }, { rst: 0, d: 1 }, { rst: 0, d: 0 }],
    makeRef: () => ({ q: 0, step(f) { this.q = f.rst ? 1 : f.d; return { q: this.q }; } })
  }
});
defRemix('s3', {
  title: 'The Enable Gate · Toggle Strain', xp: 50,
  brief: "A T flip-flop: while `en` is 1, `q` flips on every edge; while `en` is 0, it holds. `rst` clears. Toggle flops are how clock dividers are born.",
  iface: { name: 'tff', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'en', d: 'in', w: 1 }, { n: 'q', d: 'out', w: 1 }] },
  solution: "module tff(input clk, input rst, input en, output reg q);\n  always @(posedge clk) begin\n    if (rst)     q <= 1'b0;\n    else if (en) q <= ~q;\n  end\nendmodule\n",
  test: {
    type: 'seq', watch: ['q'],
    frames: [{ rst: 1, en: 0 }, { rst: 0, en: 1 }, { rst: 0, en: 1 }, { rst: 0, en: 0 }, { rst: 0, en: 1 }, { rst: 0, en: 1 }, { rst: 0, en: 1 }, { rst: 1, en: 1 }, { rst: 0, en: 0 }],
    makeRef: () => ({ q: 0, step(f) { if (f.rst) this.q = 0; else if (f.en) this.q ^= 1; return { q: this.q }; } })
  }
});
defRemix('s4', {
  title: 'The Counter · Descent Strain', xpx: 60, xp: 60,
  brief: "Count DOWN: reset loads `4'd15`, and every clock after that subtracts 1, wrapping 0 → 15. Two's complement handles the underflow — you just write the subtraction.",
  iface: { name: 'downcnt', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'q', d: 'out', w: 4 }] },
  solution: "module downcnt(input clk, input rst, output reg [3:0] q);\n  always @(posedge clk) begin\n    if (rst) q <= 4'd15;\n    else     q <= q - 1;\n  end\nendmodule\n",
  test: {
    type: 'seq', watch: ['q'],
    frames: [{ rst: 1 }].concat(Array.from({ length: 18 }, () => ({ rst: 0 }))).concat([{ rst: 1 }, { rst: 0 }, { rst: 0 }]),
    makeRef: () => ({ q: 0, step(f) { this.q = f.rst ? 15 : (this.q + 15) % 16; return { q: this.q }; } })
  }
});
defRemix('s5', {
  title: 'Shift Register · Rightward Strain', xp: 60,
  brief: "Shift RIGHT: each clock, every bit slides down one position and `sin` enters at the TOP (bit 3). The mirror of what you built — and the bug from the Bounty, done on purpose.",
  iface: { name: 'shiftr', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'sin', d: 'in', w: 1 }, { n: 'q', d: 'out', w: 4 }] },
  solution: "module shiftr(input clk, input rst, input sin, output reg [3:0] q);\n  always @(posedge clk) begin\n    if (rst) q <= 4'd0;\n    else     q <= {sin, q[3:1]};\n  end\nendmodule\n",
  test: {
    type: 'seq', watch: ['q'],
    frames: [{ rst: 1, sin: 0 }, { rst: 0, sin: 1 }, { rst: 0, sin: 0 }, { rst: 0, sin: 1 }, { rst: 0, sin: 1 }, { rst: 0, sin: 0 }, { rst: 0, sin: 1 }, { rst: 1, sin: 1 }, { rst: 0, sin: 1 }, { rst: 0, sin: 1 }],
    makeRef: () => ({ q: 0, step(f) { this.q = f.rst ? 0 : ((f.sin << 3) | (this.q >> 1)); return { q: this.q }; } })
  }
});
defRemix('s6', {
  title: 'Up / Down · Double-Step Strain', xp: 60,
  brief: "Bigger strides: `dir` = 1 adds 2 per clock, `dir` = 0 subtracts 2. Wrap is still free. Watch what stepping by 2 does to which values the counter can ever visit after reset.",
  iface: { name: 'step2', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'dir', d: 'in', w: 1 }, { n: 'q', d: 'out', w: 4 }] },
  solution: "module step2(input clk, input rst, input dir, output reg [3:0] q);\n  always @(posedge clk) begin\n    if (rst) q <= 4'd0;\n    else     q <= dir ? q + 2 : q - 2;\n  end\nendmodule\n",
  test: {
    type: 'seq', watch: ['q'],
    frames: [{ rst: 1, dir: 1 }, { rst: 0, dir: 1 }, { rst: 0, dir: 1 }, { rst: 0, dir: 0 }, { rst: 0, dir: 0 }, { rst: 0, dir: 0 }, { rst: 0, dir: 0 }, { rst: 0, dir: 1 }, { rst: 1, dir: 0 }, { rst: 0, dir: 0 }],
    makeRef: () => ({ q: 0, step(f) { this.q = f.rst ? 0 : ((this.q + (f.dir ? 2 : 14)) % 16); return { q: this.q }; } })
  }
});
defRemix('s7', {
  title: 'BOSS · Saturating Counter · Floor Strain', xp: 80, boss: true,
  brief: "Saturate at the bottom: reset loads 15, `en` counts DOWN, and at 0 it stays at 0 — no wrap. The branch-predictor cell, running in reverse.",
  iface: { name: 'sat_down', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'en', d: 'in', w: 1 }, { n: 'q', d: 'out', w: 4 }] },
  solution: "module sat_down(input clk, input rst, input en, output reg [3:0] q);\n  always @(posedge clk) begin\n    if (rst)     q <= 4'd15;\n    else if (en) q <= (q == 4'd0) ? q : q - 1;\n  end\nendmodule\n",
  test: {
    type: 'seq', watch: ['q'],
    frames: [{ rst: 1, en: 0 }].concat(Array.from({ length: 17 }, () => ({ rst: 0, en: 1 }))).concat([{ rst: 0, en: 0 }, { rst: 0, en: 1 }, { rst: 1, en: 1 }, { rst: 0, en: 1 }]),
    makeRef: () => ({ q: 0, step(f) { if (f.rst) this.q = 15; else if (f.en && this.q > 0) this.q -= 1; return { q: this.q }; } })
  }
});
defRemix('f2', {
  title: 'The Power Latch · Toggle Strain', xp: 70,
  brief: "One button now: each clock where `btn` is 1, the state flips (OFF→ON or ON→OFF); where `btn` is 0, it holds. `rst` forces OFF. Output `on_out` = 1 in ON. A two-state machine with a single self-crossing input.",
  iface: { name: 'toggle_fsm', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'btn', d: 'in', w: 1 }, { n: 'on_out', d: 'out', w: 1 }] },
  solution: "module toggle_fsm(input clk, input rst, input btn, output on_out);\n  reg state;\n  always @(posedge clk) begin\n    if (rst)      state <= 1'b0;\n    else if (btn) state <= ~state;\n  end\n  assign on_out = state;\nendmodule\n",
  test: {
    type: 'seq', watch: ['on_out'],
    frames: [{ rst: 1, btn: 0 }, { rst: 0, btn: 1 }, { rst: 0, btn: 0 }, { rst: 0, btn: 1 }, { rst: 0, btn: 1 }, { rst: 0, btn: 0 }, { rst: 1, btn: 1 }, { rst: 0, btn: 1 }, { rst: 0, btn: 0 }],
    makeRef: () => ({ s: 0, step(f) { if (f.rst) this.s = 0; else if (f.btn) this.s ^= 1; return { on_out: this.s }; } })
  }
});
defRemix('f3', {
  title: 'BOSS · Sequence Detector · 110 Strain', xp: 100, boss: true,
  brief: "New pattern: raise `z` for one cycle every time `1-1-0` completes on the stream, overlaps included (`11010` has one match; `110110` has two... trace it). Build the Moore machine from this table — note where the detect state backtracks to.",
  table: {
    cols: ['State', 'has seen', 'x=0 →', 'x=1 →', 'z'],
    rows: [
      ['S0', 'nothing', 'S0', 'S1', '0'],
      ['S1', '1', 'S0', 'S2', '0'],
      ['S2', '11', 'S3', 'S2', '0'],
      ['S3', '110 ✓', 'S0', 'S1', '1'],
    ]
  },
  iface: { name: 'seq110', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'x', d: 'in', w: 1 }, { n: 'z', d: 'out', w: 1 }] },
  solution: "module seq110(input clk, input rst, input x, output z);\n  localparam S0 = 2'd0, S1 = 2'd1, S2 = 2'd2, S3 = 2'd3;\n  reg [1:0] state, next;\n  always @(posedge clk) state <= rst ? S0 : next;\n  always @(*) begin\n    next = state;\n    case (state)\n      S0: next = x ? S1 : S0;\n      S1: next = x ? S2 : S0;\n      S2: next = x ? S2 : S3;\n      S3: next = x ? S1 : S0;\n      default: next = S0;\n    endcase\n  end\n  assign z = (state == S3);\nendmodule\n",
  test: {
    type: 'seq', watch: ['z'],
    frames: [{ rst: 1, x: 0 }, { rst: 0, x: 1 }, { rst: 0, x: 1 }, { rst: 0, x: 0 }, { rst: 0, x: 1 }, { rst: 0, x: 1 }, { rst: 0, x: 0 }, { rst: 0, x: 1 }, { rst: 0, x: 1 }, { rst: 0, x: 1 }, { rst: 0, x: 0 }, { rst: 0, x: 0 }, { rst: 0, x: 1 }, { rst: 1, x: 1 }, { rst: 0, x: 1 }, { rst: 0, x: 1 }, { rst: 0, x: 0 }],
    makeRef: () => ({
      s: 0, step(f) {
        if (f.rst) this.s = 0;
        else {
          const x = f.x;
          if (this.s === 0) this.s = x ? 1 : 0;
          else if (this.s === 1) this.s = x ? 2 : 0;
          else if (this.s === 2) this.s = x ? 2 : 3;
          else this.s = x ? 1 : 0;
        }
        return { z: this.s === 3 ? 1 : 0 };
      }
    })
  }
});
defRemix('chip1', {
  title: 'FINAL BOSS · CHIP-2', xp: 220, boss: true,
  brief: "The remixed die. Same accumulator architecture, new instruction set:\n\n`op = 2'd0` → acc + b    `op = 2'd1` → acc ^ b\n`op = 2'd2` → acc & ~b (bit-clear)    `op = 2'd3` → acc | b\n\nSynchronous reset to 0, 4-bit wrap. The bit-clear op is real ISA material — it's how status registers get individual flags knocked down. Ship the sequel.",
  iface: { name: 'chip2', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 4 }, { n: 'op', d: 'in', w: 2 }, { n: 'acc', d: 'out', w: 4 }] },
  solution: "module chip2(input clk, input rst, input [3:0] b, input [1:0] op, output reg [3:0] acc);\n  wire [3:0] alu = (op == 2'd0) ? acc + b :\n                   (op == 2'd1) ? acc ^ b :\n                   (op == 2'd2) ? acc & ~b :\n                                  acc | b;\n  always @(posedge clk) begin\n    if (rst) acc <= 4'd0;\n    else     acc <= alu;\n  end\nendmodule\n",
  test: {
    type: 'seq', watch: ['acc'],
    frames: [
      { rst: 1, b: 0, op: 0 },
      { rst: 0, b: 9, op: 0 },   // 9
      { rst: 0, b: 5, op: 1 },   // 9^5 = 12
      { rst: 0, b: 4, op: 2 },   // 12 & ~4 = 8
      { rst: 0, b: 3, op: 3 },   // 8|3 = 11
      { rst: 0, b: 7, op: 0 },   // 11+7 = 18 -> 2
      { rst: 0, b: 15, op: 1 },  // 2^15 = 13
      { rst: 0, b: 13, op: 2 },  // 13 & ~13 = 0
      { rst: 0, b: 6, op: 3 },   // 6
      { rst: 1, b: 6, op: 0 },   // 0
      { rst: 0, b: 11, op: 0 },  // 11
      { rst: 0, b: 1, op: 2 },   // 11 & ~1 = 10
    ],
    makeRef: () => ({
      a: 0, step(f) {
        if (f.rst) this.a = 0;
        else {
          if (f.op === 0) this.a = (this.a + f.b) % 16;
          else if (f.op === 1) this.a = this.a ^ f.b;
          else if (f.op === 2) this.a = this.a & (15 & ~f.b);
          else this.a = this.a | f.b;
        }
        return { acc: this.a };
      }
    })
  }
});

export { REMIX, defRemix };
