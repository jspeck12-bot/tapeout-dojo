import { combVecs, m8w } from '../util.js';

export const CODE_CHALLENGES = [
  {
      id: 'c1', world: 4, title: '2:1 Mux', xp: 50,
    brief: "The hardware if-statement. When `sel` is 1, output `y` follows input `a`; when `sel` is 0, it follows `b`.\n\nUse the ternary operator — `condition ? when_true : when_false` — which synthesizes to exactly this mux. One line.",
    iface: { name: 'mux2', ports: [{ n: 'a', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 1 }, { n: 'sel', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 1 }] },
    starter: "module mux2(\n  input  a,\n  input  b,\n  input  sel,\n  output y\n);\n  // sel=1 -> a, sel=0 -> b\n\nendmodule\n",
    hints: ["Ternary shape: `assign y = sel ? <picked when 1> : <picked when 0>;`", "`assign y = sel ? a : b;`"],
    solution: "module mux2(\n  input  a,\n  input  b,\n  input  sel,\n  output y\n);\n  assign y = sel ? a : b;\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 1 }, { n: 'b', w: 1 }, { n: 'sel', w: 1 }], (i) => ({ y: i.sel ? i.a : i.b })) }
  },
  {
    id: 'c2', world: 4, title: '4:1 Mux', xp: 50,
    brief: "Four data inputs `d0…d3`, a 2-bit select. `sel = 2'd0` picks `d0`, `2'd1` picks `d1`, and so on.\n\nTwo clean implementations: nest ternaries (test `sel[1]` first, then `sel[0]`), or use a `case` inside `always @(*)`. If you go the always route, `y` must be declared `output reg`, and cover all four cases.",
    iface: { name: 'mux4', ports: [{ n: 'd0', d: 'in', w: 1 }, { n: 'd1', d: 'in', w: 1 }, { n: 'd2', d: 'in', w: 1 }, { n: 'd3', d: 'in', w: 1 }, { n: 'sel', d: 'in', w: 2 }, { n: 'y', d: 'out', w: 1 }] },
    starter: "module mux4(\n  input        d0,\n  input        d1,\n  input        d2,\n  input        d3,\n  input  [1:0] sel,\n  output       y\n);\n  // pick d0..d3 by sel\n\nendmodule\n",
    hints: ["Nested ternary: outer chooses the pair (`sel[1]`), inner chooses within it (`sel[0]`).", "`assign y = sel[1] ? (sel[0] ? d3 : d2) : (sel[0] ? d1 : d0);`", "Or: `always @(*) case (sel) ... endcase` with `output reg y` and a `default`."],
    solution: "module mux4(\n  input        d0,\n  input        d1,\n  input        d2,\n  input        d3,\n  input  [1:0] sel,\n  output       y\n);\n  assign y = sel[1] ? (sel[0] ? d3 : d2)\n                    : (sel[0] ? d1 : d0);\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'd0', w: 1 }, { n: 'd1', w: 1 }, { n: 'd2', w: 1 }, { n: 'd3', w: 1 }, { n: 'sel', w: 2 }], (i) => ({ y: [i.d0, i.d1, i.d2, i.d3][i.sel] })) }
  },
  {
    id: 'c3', world: 4, title: 'Full Adder', xp: 50,
    brief: "The half adder's grown-up sibling: three inputs (`a`, `b`, and a carry-in `cin`), so it can sit in the middle of a multi-bit chain.\n\n`sum` is the XOR of all three. `cout` fires when any two inputs are 1 — sound familiar? You built that voting logic in the Foundry.",
    iface: { name: 'full_adder', ports: [{ n: 'a', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 1 }, { n: 'cin', d: 'in', w: 1 }, { n: 'sum', d: 'out', w: 1 }, { n: 'cout', d: 'out', w: 1 }] },
    starter: "module full_adder(\n  input  a,\n  input  b,\n  input  cin,\n  output sum,\n  output cout\n);\n  // sum: XOR of all three\n  // cout: any two inputs high\n\nendmodule\n",
    hints: ["`sum = a ^ b ^ cin` — XOR chains.", "cout is the majority function of (a, b, cin).", "Slick alternative: `assign {cout, sum} = a + b + cin;` — let the adder be an adder."],
    solution: "module full_adder(\n  input  a,\n  input  b,\n  input  cin,\n  output sum,\n  output cout\n);\n  assign sum  = a ^ b ^ cin;\n  assign cout = (a & b) | (cin & (a ^ b));\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 1 }, { n: 'b', w: 1 }, { n: 'cin', w: 1 }], (i) => { const t = i.a + i.b + i.cin; return { sum: t & 1, cout: t >> 1 }; }) }
  },
  {
    id: 'c4', world: 4, title: '4-Bit Adder', xp: 55,
    brief: "Add two 4-bit numbers and don't lose the carry. The true result of `a + b` needs 5 bits — the top one is your `cout`, the low four are `sum`.\n\nThe idiomatic move: assign to a concatenation. `{cout, sum}` is a 5-bit target, and Verilog splits the result across it automatically. One line, full adder chain, carry preserved.",
    iface: { name: 'adder4', ports: [{ n: 'a', d: 'in', w: 4 }, { n: 'b', d: 'in', w: 4 }, { n: 'sum', d: 'out', w: 4 }, { n: 'cout', d: 'out', w: 1 }] },
    starter: "module adder4(\n  input  [3:0] a,\n  input  [3:0] b,\n  output [3:0] sum,\n  output       cout\n);\n  // 5-bit result: {cout, sum}\n\nendmodule\n",
    hints: ["Concatenation works on the LEFT of an assign too — it's a split.", "`assign {cout, sum} = a + b;`"],
    solution: "module adder4(\n  input  [3:0] a,\n  input  [3:0] b,\n  output [3:0] sum,\n  output       cout\n);\n  assign {cout, sum} = a + b;\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 4 }, { n: 'b', w: 4 }], (i) => { const t = i.a + i.b; return { sum: t & 15, cout: t >> 4 }; }) }
  },
  {
    id: 'c5', world: 4, title: '2:4 Decoder', xp: 55,
    brief: "Turn a 2-bit number into a one-hot line. While `en` is 1, exactly one bit of `y` is high: input `2'd0` lights `y[0]`, `2'd2` lights `y[2]`. When `en` is 0, all outputs are 0.\n\nElegant route: shift a lone 1 left by the input value, gated by enable. Brute-force route: four ternaries or a case. Both synthesize fine — pick your style.",
    iface: { name: 'decoder24', ports: [{ n: 'a', d: 'in', w: 2 }, { n: 'en', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 4 }] },
    starter: "module decoder24(\n  input  [1:0] a,\n  input        en,\n  output [3:0] y\n);\n  // one-hot when en, else 0\n\nendmodule\n",
    hints: ["`4'b0001 << a` walks the hot bit to position a.", "Gate with enable using a ternary: `en ? ... : 4'b0`.", "`assign y = en ? (4'b0001 << a) : 4'b0000;`"],
    solution: "module decoder24(\n  input  [1:0] a,\n  input        en,\n  output [3:0] y\n);\n  assign y = en ? (4'b0001 << a) : 4'b0000;\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 2 }, { n: 'en', w: 1 }], (i) => ({ y: i.en ? (1 << i.a) : 0 })) }
  },
  {
    id: 'c6', world: 4, title: 'Absolute Value', xp: 55,
    brief: "World 1 meets World 4. Input `a` is an 8-bit two's-complement number; output `y` is its absolute value.\n\nCheck the sign bit `a[7]`. If it's set, the number is negative — negate it (invert + 1, or unary minus). Otherwise pass it through. One ternary does it.\n\n(Edge-case trivia: |−128| can't fit in 8 bits, so it wraps back to `0x80`. Your circuit and the reference will agree; real DSP hardware ships with exactly this wrinkle.)",
    iface: { name: 'abs8', ports: [{ n: 'a', d: 'in', w: 8 }, { n: 'y', d: 'out', w: 8 }] },
    starter: "module abs8(\n  input  [7:0] a,\n  output [7:0] y\n);\n  // negative? negate. else pass.\n\nendmodule\n",
    hints: ["The sign lives in `a[7]`.", "Negation in two's complement: `~a + 1`, or simply `-a` — Verilog wraps it for you.", "`assign y = a[7] ? (~a + 1) : a;`"],
    solution: "module abs8(\n  input  [7:0] a,\n  output [7:0] y\n);\n  assign y = a[7] ? (~a + 1) : a;\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 8 }], (i) => ({ y: i.a >= 128 ? m8w(256 - i.a) : i.a })) }
  },
  {
    id: 'c7', world: 4, title: 'BOSS · Priority Encoder', xp: 80, boss: true,
    brief: "The Canyon's gatekeeper. A priority encoder answers: which is the highest request line currently asserted?\n\nGiven 4 request bits `in_req`, output `pos` = the index of the highest set bit (bit 3 beats all), and `valid` = 1 if any bit is set at all. When nothing is requesting, `pos` should be `2'd0` and `valid` 0.\n\nThis circuit sits inside every interrupt controller ever made. A ternary chain handles the priority naturally — check bit 3 first and fall through. For `valid`, the reduction operator `|in_req` ORs a whole bus into one bit.",
    iface: { name: 'prio_enc', ports: [{ n: 'in_req', d: 'in', w: 4 }, { n: 'pos', d: 'out', w: 2 }, { n: 'valid', d: 'out', w: 1 }] },
    starter: "module prio_enc(\n  input  [3:0] in_req,\n  output [1:0] pos,\n  output       valid\n);\n  // highest set bit wins\n\nendmodule\n",
    hints: ["Priority = ordered ternaries: `in_req[3] ? 2'd3 : in_req[2] ? 2'd2 : ...`", "Reduction OR collapses a bus: `assign valid = |in_req;`", "`assign pos = in_req[3] ? 2'd3 : in_req[2] ? 2'd2 : in_req[1] ? 2'd1 : 2'd0;`"],
    solution: "module prio_enc(\n  input  [3:0] in_req,\n  output [1:0] pos,\n  output       valid\n);\n  assign pos   = in_req[3] ? 2'd3 :\n                 in_req[2] ? 2'd2 :\n                 in_req[1] ? 2'd1 : 2'd0;\n  assign valid = |in_req;\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'in_req', w: 4 }], (i) => ({ pos: i.in_req >= 8 ? 3 : i.in_req >= 4 ? 2 : i.in_req >= 2 ? 1 : 0, valid: i.in_req ? 1 : 0 })) }
  },
  {
    id: 'c8', world: 4, title: 'The Comparator', xp: 55,
    brief: "A 4-bit magnitude comparator — the hardware behind every `if (x > y)`. Three single-bit flags report how `a` relates to `b`: `gt` when a is larger, `eq` when they match, `lt` when a is smaller. Verilog's relational operators each evaluate to a single bit, so feed one to each flag. For any pair, exactly one flag is high.",
    iface: { name: 'cmp4', ports: [{ n: 'a', d: 'in', w: 4 }, { n: 'b', d: 'in', w: 4 }, { n: 'gt', d: 'out', w: 1 }, { n: 'eq', d: 'out', w: 1 }, { n: 'lt', d: 'out', w: 1 }] },
    starter: "module cmp4(\n  input  [3:0] a,\n  input  [3:0] b,\n  output       gt,\n  output       eq,\n  output       lt\n);\n  // gt: a>b   eq: a==b   lt: a<b\n\nendmodule\n",
    hints: ["Each relational operator returns one bit — `a > b` is 1 when a is bigger, else 0.", "Three continuous assignments, one per flag.", "`assign gt = (a > b); assign eq = (a == b); assign lt = (a < b);`"],
    solution: "module cmp4(\n  input  [3:0] a,\n  input  [3:0] b,\n  output       gt,\n  output       eq,\n  output       lt\n);\n  assign gt = (a > b);\n  assign eq = (a == b);\n  assign lt = (a < b);\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 4 }, { n: 'b', w: 4 }], (i) => ({ gt: i.a > i.b ? 1 : 0, eq: i.a === i.b ? 1 : 0, lt: i.a < i.b ? 1 : 0 })) }
  },
  {
    id: 'c9', world: 4, title: 'The ALU', xp: 65,
    brief: "The arithmetic-logic unit — the computational core every processor is built around. A 2-bit `op` selects the operation on `a` and `b`: `2'd0` add, `2'd1` subtract, `2'd2` bitwise AND, `2'd3` bitwise OR. The 4-bit result lands on `y`, and arithmetic wraps at 4 bits. A `case` inside `always @(*)` reads cleanly — and because `y` is driven from a procedural block, it must be declared `reg`.",
    iface: { name: 'alu4', ports: [{ n: 'a', d: 'in', w: 4 }, { n: 'b', d: 'in', w: 4 }, { n: 'op', d: 'in', w: 2 }, { n: 'y', d: 'out', w: 4 }] },
    starter: "module alu4(\n  input  [3:0] a,\n  input  [3:0] b,\n  input  [1:0] op,\n  output reg [3:0] y\n);\n  // 0:add  1:sub  2:and  3:or\n  always @(*) begin\n\n  end\nendmodule\n",
    hints: ["`always @(*)` with a `case (op)` — one branch per opcode.", "Cover every opcode; a `default` branch handles the last one cleanly.", "`case (op) 2'd0: y=a+b; 2'd1: y=a-b; 2'd2: y=a&b; default: y=a|b; endcase`"],
    solution: "module alu4(\n  input  [3:0] a,\n  input  [3:0] b,\n  input  [1:0] op,\n  output reg [3:0] y\n);\n  always @(*) begin\n    case (op)\n      2'd0: y = a + b;\n      2'd1: y = a - b;\n      2'd2: y = a & b;\n      default: y = a | b;\n    endcase\n  end\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 4 }, { n: 'b', w: 4 }, { n: 'op', w: 2 }], (i) => ({ y: ((i.op === 0 ? i.a + i.b : i.op === 1 ? i.a - i.b : i.op === 2 ? (i.a & i.b) : (i.a | i.b)) & 15) })) }
  },
  {
    id: 'c10', world: 4, title: 'Seven-Segment', xp: 60,
    brief: "A hex seven-segment decoder — turns a 4-bit value into the seven segment-drive signals of a digit display. Outputs are active-high in the order `y = {g,f,e,d,c,b,a}`, so `y[0]` drives segment a. A `case` over all sixteen values 0–F is the readable route; `y` is `reg` because it's assigned procedurally. For reference, `0` lights every segment except the middle bar `g`: `7'b0111111`.",
    iface: { name: 'seg7', ports: [{ n: 'x', d: 'in', w: 4 }, { n: 'y', d: 'out', w: 7 }] },
    starter: "module seg7(\n  input  [3:0] x,\n  output reg [6:0] y\n);\n  // y = {g,f,e,d,c,b,a}, active high; cover 0-F\n  always @(*) begin\n\n  end\nendmodule\n",
    hints: ["`case (x)` with one branch per digit; `y` must be `output reg`.", "Bit order is `{g,f,e,d,c,b,a}` — segment a is the least-significant bit, g the most.", "`4'd0: y = 7'b0111111;` ... through `4'd15: y = 7'b1110001;` — use `default` for F."],
    solution: "module seg7(\n  input  [3:0] x,\n  output reg [6:0] y\n);\n  always @(*) begin\n    case (x)\n      4'd0:  y = 7'b0111111;\n      4'd1:  y = 7'b0000110;\n      4'd2:  y = 7'b1011011;\n      4'd3:  y = 7'b1001111;\n      4'd4:  y = 7'b1100110;\n      4'd5:  y = 7'b1101101;\n      4'd6:  y = 7'b1111101;\n      4'd7:  y = 7'b0000111;\n      4'd8:  y = 7'b1111111;\n      4'd9:  y = 7'b1101111;\n      4'd10: y = 7'b1110111;\n      4'd11: y = 7'b1111100;\n      4'd12: y = 7'b0111001;\n      4'd13: y = 7'b1011110;\n      4'd14: y = 7'b1111001;\n      default: y = 7'b1110001;\n    endcase\n  end\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'x', w: 4 }], (i) => ({ y: [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F, 0x77, 0x7C, 0x39, 0x5E, 0x79, 0x71][i.x] })) }
  },
  {
    id: 'c11', world: 4, title: 'The Multiplier', xp: 65,
    brief: "A 2-bit unsigned multiplier — the seed of every multiply unit. Multiply `a` by `b` (each 0–3) into the 4-bit product `p` (the largest, 3×3=9, fits in 4 bits). Verilog's `*` synthesizes to an array of AND gates summed by adders; here you write the multiply and let the tool build that partial-product tree.",
    iface: { name: 'mul2', ports: [{ n: 'a', d: 'in', w: 2 }, { n: 'b', d: 'in', w: 2 }, { n: 'p', d: 'out', w: 4 }] },
    starter: "module mul2(\n  input  [1:0] a,\n  input  [1:0] b,\n  output [3:0] p\n);\n  // p = a * b\n\nendmodule\n",
    hints: ["`*` multiplies; the 4-bit output holds the largest product (3×3=9).", "One continuous assignment does it.", "`assign p = a * b;`"],
    solution: "module mul2(\n  input  [1:0] a,\n  input  [1:0] b,\n  output [3:0] p\n);\n  assign p = a * b;\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 2 }, { n: 'b', w: 2 }], (i) => ({ p: (i.a * i.b) & 15 })) }
  },
];

