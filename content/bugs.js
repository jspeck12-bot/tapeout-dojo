// ---------- Bug Bounty ----------
const BUG_HUNTS = [
  {
    id: 'bug1', title: 'The Mixed-Up Counter', cat: '= vs <=',
    lines: ["module counter(input clk, input rst,", "               output reg [3:0] q);", "  always @(posedge clk) begin", "    if (rst)", "      q <= 4'd0;", "    else", "      q = q + 1;", "  end", "endmodule"],
    bug: 6,
    why: "Blocking '=' inside a clocked always block. Clocked logic must use non-blocking '<=' so every register samples its pre-edge inputs simultaneously — mixing styles makes simulation disagree with silicon.",
    fix: "q <= q + 1;"
  },
  {
    id: 'bug2', title: 'The Phantom Latch', cat: 'latch inference',
    lines: ["module gated(input en, input [3:0] a,", "             output reg [3:0] y);", "  always @(*) begin", "    if (en)", "      y = a;", "  end", "endmodule"],
    bug: 3,
    why: "Combinational if with no else. When en=0, y must 'keep its old value' — but keeping a value requires memory, so synthesis infers an unintended latch. Combinational blocks must assign every output on every path.",
    fix: "Add: else y = 4'd0; (or whatever the en=0 value should be)"
  },
  {
    id: 'bug3', title: 'Identity Crisis', cat: 'reg vs wire',
    lines: ["module and2(input a, input b,", "            output y);", "  reg y_int;", "  assign y_int = a & b;", "  assign y = y_int;", "endmodule"],
    bug: 3,
    why: "assign can't drive a reg. Continuous assignments drive wires; regs are driven from inside always blocks. (The names are historical baggage — 'reg' doesn't mean register, it means 'assigned procedurally'.)",
    fix: "wire y_int;"
  },
  {
    id: 'bug4', title: 'The Stale List', cat: 'sensitivity',
    lines: ["module orer(input a, input b,", "            output reg y);", "  always @(a) begin", "    y = a | b;", "  end", "endmodule"],
    bug: 2,
    why: "The sensitivity list only watches 'a' — when b changes, y doesn't update in simulation, but the synthesized gates DO respond to b. Sim and silicon now disagree. always @(*) tracks every input automatically.",
    fix: "always @(*) begin"
  },
  {
    id: 'bug5', title: 'Assignment Heist', cat: '= vs ==',
    lines: ["module pick(input [1:0] sel, input a, input b,", "            output reg y);", "  always @(*) begin", "    if (sel == 2'd1)", "      y = a;", "    else if (sel = 2'd2)", "      y = b;", "    else", "      y = 1'b0;", "  end", "endmodule"],
    bug: 5,
    why: "'=' assigns, '==' compares. Inside a condition you want the comparison. (Verilog won't even parse an assignment there — but the C-programmer reflex writes it constantly.)",
    fix: "else if (sel == 2'd2)"
  },
  {
    id: 'bug6', title: 'Shorted Wires', cat: 'multiple drivers',
    lines: ["module both(input a, input b,", "            output y);", "  assign y = a & b;", "  assign y = a | b;", "endmodule"],
    bug: 3,
    why: "Two assigns to the same wire = two gate outputs physically shorted together. When they disagree, real silicon fights itself (and loses). Every wire gets exactly one driver.",
    fix: "Delete one driver, or output two separate signals."
  },
  {
    id: 'bug7', title: 'The Narrow Bridge', cat: 'bit width',
    lines: ["module add5(input [3:0] a, input [3:0] b,", "            output [4:0] total);", "  wire [3:0] sum;", "  assign sum = a + b;", "  assign total = sum;", "endmodule"],
    bug: 2,
    why: "The intermediate wire is only 4 bits, so the carry of a+b is truncated before it ever reaches the 5-bit output. 15+15=30 would come out as 14. The result of adding two N-bit numbers needs N+1 bits the whole way.",
    fix: "wire [4:0] sum;  (or skip the wire: assign total = a + b;)"
  },
  {
    id: 'bug8', title: 'Logical Fallacy', cat: '& vs &&',
    lines: ["module buswise(input [3:0] a, input [3:0] b,", "               output [3:0] y);", "  // intent: bitwise AND of the buses", "  assign y = a && b;", "endmodule"],
    bug: 3,
    why: "'&&' is logical AND: it collapses each bus to true/false and yields a single bit. For lane-by-lane bus operations you want bitwise '&'. With a=4'b1010, b=4'b0101: a&&b = 1, but a&b = 4'b0000.",
    fix: "assign y = a & b;"
  },
  {
    id: 'bug9', title: 'Wrong Tool, Wrong World', cat: '= vs <=',
    lines: ["module xorit(input a, input b,", "             output reg y);", "  always @(*) begin", "    y <= a ^ b;", "  end", "endmodule"],
    bug: 3,
    why: "Non-blocking '<=' inside combinational always @(*). The pairing is law: clocked → '<=', combinational → '='. Breaking it invites simulation-ordering weirdness with zero benefit.",
    fix: "y = a ^ b;"
  },
  {
    id: 'bug10', title: 'Off the Map', cat: 'indexing',
    lines: ["module msb(input [7:0] data,", "           output top);", "  assign top = data[8];", "endmodule"],
    bug: 2,
    why: "An 8-bit bus declared [7:0] has bits 7 down to 0 — there is no bit 8. Classic off-by-one: width 8, highest index 7.",
    fix: "assign top = data[7];"
  },
  {
    id: 'bug11', title: 'The Caseless Default', cat: 'latch inference',
    lines: ["module mux3(input [1:0] sel,", "            input a, input b, input c,", "            output reg y);", "  always @(*) begin", "    case (sel)", "      2'd0: y = a;", "      2'd1: y = b;", "      2'd2: y = c;", "    endcase", "  end", "endmodule"],
    bug: 4,
    why: "The case covers 0, 1, 2 — but sel is 2 bits, so 2'd3 can happen. With no default, y holds its old value on that path → inferred latch in combinational logic. Every comb case needs a default (or full coverage).",
    fix: "Add before endcase: default: y = 1'b0;"
  },
  {
    id: 'bug12', title: 'Wrong-Way Shifter', cat: 'concatenation',
    lines: ["// shift LEFT each clock; sin enters at bit 0", "module sh(input clk, input sin,", "          output reg [3:0] q);", "  always @(posedge clk)", "    q <= {sin, q[3:1]};", "endmodule"],
    bug: 4,
    why: "{sin, q[3:1]} puts sin at the TOP and slides everything down — that's a right shift. For a left shift with sin entering at bit 0, keep the low bits and append: {q[2:0], sin}.",
    fix: "q <= {q[2:0], sin};"
  },
];

export { BUG_HUNTS };
