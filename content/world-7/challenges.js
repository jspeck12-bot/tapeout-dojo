export const CODE_CHALLENGES = [
  {
      id: 'chip1', world: 7, title: 'FINAL BOSS · CHIP-1', xp: 220, boss: true,
    brief: "The accumulator machine. Everything you've built, fused into one die.\n\nCHIP-1 holds a 4-bit accumulator `acc`. Every clock edge it executes one instruction: combine the current `acc` with input `b` through an ALU, and store the result back. The 2-bit opcode picks the operation:\n\n`op = 2'd0` → acc + b    `op = 2'd1` → acc − b\n`op = 2'd2` → acc & b    `op = 2'd3` → acc | b\n\nSynchronous reset clears `acc` to 0. Arithmetic wraps at 4 bits (the odometer, one last time).\n\nArchitecture hint: this is a combinational ALU (Canyon skills — a ternary chain or a case) feeding a register (Tower skills — one clocked block). Compute the ALU result from the current `acc`, and capture it with `<=`. The testbench will run a real program through your machine. Ship it.",
    iface: { name: 'chip1', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 4 }, { n: 'op', d: 'in', w: 2 }, { n: 'acc', d: 'out', w: 4 }] },
    starter: "module chip1(\n  input            clk,\n  input            rst,\n  input      [3:0] b,\n  input      [1:0] op,\n  output reg [3:0] acc\n);\n  // ALU: pick the op, combine acc with b\n  // Register: capture the result each clock\n\nendmodule\n",
    hints: ["Wire up the ALU first: `wire [3:0] alu = (op == 2'd0) ? acc + b : (op == 2'd1) ? acc - b : (op == 2'd2) ? acc & b : acc | b;`", "Then the register is two lines: `always @(posedge clk) begin if (rst) acc <= 4'd0; else acc <= alu; end`", "A `case (op)` inside the clocked block also works — four non-blocking assignments, reset first. Subtraction wraps automatically: 4-bit two's complement is doing the work."],
    solution: "module chip1(\n  input            clk,\n  input            rst,\n  input      [3:0] b,\n  input      [1:0] op,\n  output reg [3:0] acc\n);\n  wire [3:0] alu = (op == 2'd0) ? acc + b :\n                   (op == 2'd1) ? acc - b :\n                   (op == 2'd2) ? acc & b :\n                                  acc | b;\n\n  always @(posedge clk) begin\n    if (rst) acc <= 4'd0;\n    else     acc <= alu;\n  end\nendmodule\n",
    test: {
      type: 'seq', watch: ['acc'],
      frames: [
        { rst: 1, b: 0, op: 0 },
        { rst: 0, b: 5, op: 0 },   // 0+5 = 5
        { rst: 0, b: 3, op: 0 },   // 5+3 = 8
        { rst: 0, b: 2, op: 1 },   // 8-2 = 6
        { rst: 0, b: 12, op: 2 },  // 6 & 12 = 4
        { rst: 0, b: 1, op: 3 },   // 4 | 1 = 5
        { rst: 0, b: 7, op: 1 },   // 5-7 = -2 -> 14
        { rst: 0, b: 9, op: 0 },   // 14+9 = 23 -> 7
        { rst: 1, b: 15, op: 3 },  // reset -> 0
        { rst: 0, b: 15, op: 3 },  // 0 | 15 = 15
        { rst: 0, b: 1, op: 0 },   // 15+1 -> 0
        { rst: 0, b: 6, op: 0 },   // 6
        { rst: 0, b: 10, op: 2 },  // 6 & 10 = 2
      ],
      makeRef: () => ({
        a: 0, step(f) {
          if (f.rst) this.a = 0;
          else {
            const b = f.b;
            if (f.op === 0) this.a = (this.a + b) % 16;
            else if (f.op === 1) this.a = ((this.a - b) % 16 + 16) % 16;
            else if (f.op === 2) this.a = this.a & b;
            else this.a = this.a | b;
          }
          return { acc: this.a };
        }
      })
    }
  },

];
