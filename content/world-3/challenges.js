import { combVecs } from '../util.js';

export const CODE_CHALLENGES = [
  {
    id: 'm1', world: 3, title: 'First Contact', xp: 40,
    brief: "Your first piece of real hardware. Inside the module shell, drive output `y` so it's the logical AND of inputs `a` and `b`.\n\nRemember: `assign` isn't a command that runs — it's a wire you're soldering. Once written, `y` tracks `a & b` forever.",
    iface: { name: 'and_gate', ports: [{ n: 'a', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 1 }] },
    starter: "module and_gate(\n  input  a,\n  input  b,\n  output y\n);\n  // drive y with a AND b\n\nendmodule\n",
    hints: ["The continuous-assignment keyword is `assign`.", "Bitwise AND is the `&` operator.", "Full statement shape: `assign <output> = <expression>;` — don't forget the semicolon."],
    solution: "module and_gate(\n  input  a,\n  input  b,\n  output y\n);\n  assign y = a & b;\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 1 }, { n: 'b', w: 1 }], (i) => ({ y: i.a & i.b })) }
  },
  {
    id: 'm2', world: 3, title: 'Universal NAND', xp: 40,
    brief: "Build the gate that builds everything else. Output `y` should be the NAND of `a` and `b` — AND, then inverted.\n\nThere's no `nand` operator to lean on. Compose it from `&` and `~`, and mind your parentheses: you're inverting the result, not an input.",
    iface: { name: 'nand_gate', ports: [{ n: 'a', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 1 }] },
    starter: "module nand_gate(\n  input  a,\n  input  b,\n  output y\n);\n  // y = NOT (a AND b)\n\nendmodule\n",
    hints: ["NOT is the `~` operator.", "`~a & b` inverts only `a`. You want the whole AND inverted.", "`assign y = ~(a & b);`"],
    solution: "module nand_gate(\n  input  a,\n  input  b,\n  output y\n);\n  assign y = ~(a & b);\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 1 }, { n: 'b', w: 1 }], (i) => ({ y: (i.a & i.b) ^ 1 })) }
  },
  {
    id: 'm3', world: 3, title: 'The Half Adder', xp: 45,
    brief: "Addition begins here. A half adder adds two bits and produces two outputs: `sum` (the low bit of the result) and `carry` (the overflow into the next column).\n\n0+1 = sum 1, carry 0. 1+1 = sum 0, carry 1. Look at those patterns — `sum` and `carry` are each a gate you already know. One assign per output.",
    iface: { name: 'half_adder', ports: [{ n: 'a', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 1 }, { n: 'sum', d: 'out', w: 1 }, { n: 'carry', d: 'out', w: 1 }] },
    starter: "module half_adder(\n  input  a,\n  input  b,\n  output sum,\n  output carry\n);\n  // sum: 1 when a and b differ\n  // carry: 1 only when both are 1\n\nendmodule\n",
    hints: ["'1 when the inputs differ' is the definition of one specific gate.", "'1 only when both are 1' is another gate you met in Gate Valley.", "`sum = a ^ b`, `carry = a & b`. XOR adds; AND carries. This pattern is the seed of every adder ever built."],
    solution: "module half_adder(\n  input  a,\n  input  b,\n  output sum,\n  output carry\n);\n  assign sum   = a ^ b;\n  assign carry = a & b;\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 1 }, { n: 'b', w: 1 }], (i) => ({ sum: i.a ^ i.b, carry: i.a & i.b })) }
  },
  {
    id: 'm4', world: 3, title: 'Majority Rules', xp: 45,
    brief: "Three inputs vote. Output `y` is 1 when two or more of `a`, `b`, `c` are 1.\n\nThis little circuit is real aerospace hardware: triple-redundant flight computers vote exactly like this, so one failed unit gets outvoted. Express it as an OR of pairwise ANDs — which pairs need checking?",
    iface: { name: 'majority', ports: [{ n: 'a', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 1 }, { n: 'c', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 1 }] },
    starter: "module majority(\n  input  a,\n  input  b,\n  input  c,\n  output y\n);\n  // 1 when at least two inputs are 1\n\nendmodule\n",
    hints: ["If any pair of inputs is both-1, the majority is reached.", "There are three pairs: ab, bc, ac.", "`assign y = (a & b) | (b & c) | (a & c);`"],
    solution: "module majority(\n  input  a,\n  input  b,\n  input  c,\n  output y\n);\n  assign y = (a & b) | (b & c) | (a & c);\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 1 }, { n: 'b', w: 1 }, { n: 'c', w: 1 }], (i) => ({ y: (i.a + i.b + i.c) >= 2 ? 1 : 0 })) }
  },
  {
    id: 'm5', world: 3, title: 'Bus Work', xp: 45,
    brief: "Operators scale to buses for free. Given two 4-bit buses `a` and `b`, produce three 4-bit outputs: `y_and`, `y_or`, `y_xor` — the bitwise AND, OR, and XOR of the buses.\n\nEach assign you write is four parallel gates. No loops, no indexing — the bus notation does the fan-out.",
    iface: { name: 'bus_ops', ports: [{ n: 'a', d: 'in', w: 4 }, { n: 'b', d: 'in', w: 4 }, { n: 'y_and', d: 'out', w: 4 }, { n: 'y_or', d: 'out', w: 4 }, { n: 'y_xor', d: 'out', w: 4 }] },
    starter: "module bus_ops(\n  input  [3:0] a,\n  input  [3:0] b,\n  output [3:0] y_and,\n  output [3:0] y_or,\n  output [3:0] y_xor\n);\n  // three assigns, three buses\n\nendmodule\n",
    hints: ["Exactly the same operators as 1-bit logic: `&`, `|`, `^`.", "`assign y_and = a & b;` — Verilog applies it lane by lane across all 4 bits."],
    solution: "module bus_ops(\n  input  [3:0] a,\n  input  [3:0] b,\n  output [3:0] y_and,\n  output [3:0] y_or,\n  output [3:0] y_xor\n);\n  assign y_and = a & b;\n  assign y_or  = a | b;\n  assign y_xor = a ^ b;\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 4 }, { n: 'b', w: 4 }], (i) => ({ y_and: i.a & i.b, y_or: i.a | i.b, y_xor: i.a ^ i.b })) }
  },
  {
    id: 'm6', world: 3, title: 'Nibble Swap', xp: 45,
    brief: "Pure wiring, zero gates. Take the 8-bit input `in_byte` and swap its halves: the low nibble `in_byte[3:0]` becomes the top of `out_byte`, and the high nibble drops to the bottom.\n\n`0xA5` becomes `0x5A`. Use part-selects and one concatenation — `{high_part, low_part}` builds a bus from pieces.",
    iface: { name: 'nibble_swap', ports: [{ n: 'in_byte', d: 'in', w: 8 }, { n: 'out_byte', d: 'out', w: 8 }] },
    starter: "module nibble_swap(\n  input  [7:0] in_byte,\n  output [7:0] out_byte\n);\n  // {low nibble, high nibble}\n\nendmodule\n",
    hints: ["Slice with part-selects: `in_byte[7:4]` is the high nibble, `in_byte[3:0]` the low.", "Concatenation `{x, y}` places x in the upper bits.", "`assign out_byte = {in_byte[3:0], in_byte[7:4]};`"],
    solution: "module nibble_swap(\n  input  [7:0] in_byte,\n  output [7:0] out_byte\n);\n  assign out_byte = {in_byte[3:0], in_byte[7:4]};\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'in_byte', w: 8 }], (i) => ({ out_byte: ((i.in_byte & 15) * 16) + (i.in_byte >> 4) })) }
  },
  {
    id: 'm7', world: 3, title: 'Barrel Shifter', xp: 45,
    brief: "A shifter that moves bits by a runtime amount — the datapath block behind `>>` in any CPU. Shift the 4-bit value `a` right by `sh` positions (0 to 3), with zeros sliding in from the top. Verilog's `>>` operator does exactly this when the right side is a signal, synthesizing to a barrel shifter — a stack of muxes choosing each output bit.",
    iface: { name: 'barrel_r', ports: [{ n: 'a', d: 'in', w: 4 }, { n: 'sh', d: 'in', w: 2 }, { n: 'y', d: 'out', w: 4 }] },
    starter: "module barrel_r(\n  input  [3:0] a,\n  input  [1:0] sh,\n  output [3:0] y\n);\n  // a shifted right by sh, zero-filled\n\nendmodule\n",
    hints: ["`>>` shifts right; when the amount is a signal it builds a barrel shifter.", "For an unsigned value, zeros fill the vacated top bits automatically.", "`assign y = a >> sh;`"],
    solution: "module barrel_r(\n  input  [3:0] a,\n  input  [1:0] sh,\n  output [3:0] y\n);\n  assign y = a >> sh;\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 4 }, { n: 'sh', w: 2 }], (i) => ({ y: (i.a >> i.sh) & 15 })) }
  },
];

