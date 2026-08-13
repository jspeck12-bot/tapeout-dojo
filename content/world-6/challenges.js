export const CODE_CHALLENGES = [
  {
      id: 'f2', world: 6, title: 'The Power Latch', xp: 70,
    brief: "Your first full state machine — a two-state Moore controller. The system is OFF until `go` pulses it ON; it stays ON until `stop` pulses it OFF. Output `on_out` is 1 exactly while in the ON state.\n\nUse the three-block pattern from the lesson: a clocked state register (reset to OFF), next-state logic (a `case` in `always @(*)`, or fold it into the clocked block for a machine this small), and an `assign` for the output. Name your states with `localparam OFF = 1'd0, ON = 1'd1;` — code that reads like the diagram.\n\nIf `go` and `stop` arrive together while OFF, `go` wins (you turn on).",
    iface: { name: 'power_fsm', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'go', d: 'in', w: 1 }, { n: 'stop', d: 'in', w: 1 }, { n: 'on_out', d: 'out', w: 1 }] },
    starter: "module power_fsm(\n  input  clk,\n  input  rst,\n  input  go,\n  input  stop,\n  output on_out\n);\n  localparam OFF = 1'd0, ON = 1'd1;\n  reg state;\n\n  // 1) state register (clocked, reset to OFF)\n\n  // 2) transitions: OFF--go-->ON, ON--stop-->OFF\n\n  // 3) output: assign on_out = (state == ON);\n\nendmodule\n",
    hints: ["Smallest version: one clocked block. `if (rst) state <= OFF; else case (state) OFF: if (go) state <= ON; ON: if (stop) state <= OFF; endcase`", "A case item with an if and no else just holds state — perfect for FSMs.", "Output is pure decode: `assign on_out = (state == ON);`"],
    solution: "module power_fsm(\n  input  clk,\n  input  rst,\n  input  go,\n  input  stop,\n  output on_out\n);\n  localparam OFF = 1'd0, ON = 1'd1;\n  reg state;\n\n  always @(posedge clk) begin\n    if (rst) state <= OFF;\n    else begin\n      case (state)\n        OFF: if (go)   state <= ON;\n        ON:  if (stop) state <= OFF;\n      endcase\n    end\n  end\n\n  assign on_out = (state == ON);\nendmodule\n",
    test: {
      type: 'seq', watch: ['on_out'],
      frames: [{ rst: 1, go: 0, stop: 0 }, { rst: 0, go: 0, stop: 0 }, { rst: 0, go: 1, stop: 0 }, { rst: 0, go: 0, stop: 0 }, { rst: 0, go: 0, stop: 0 }, { rst: 0, go: 0, stop: 1 }, { rst: 0, go: 0, stop: 0 }, { rst: 0, go: 1, stop: 1 }, { rst: 0, go: 0, stop: 0 }, { rst: 0, go: 0, stop: 1 }, { rst: 0, go: 1, stop: 0 }, { rst: 1, go: 1, stop: 0 }, { rst: 0, go: 0, stop: 0 }],
      makeRef: () => ({
        s: 0, step(f) {
          if (f.rst) this.s = 0;
          else if (this.s === 0) { if (f.go) this.s = 1; }
          else { if (f.stop) this.s = 0; }
          return { on_out: this.s };
        }
      })
    }
  },
  {
    id: 'f3', world: 6, title: 'BOSS · Sequence Detector 101', xp: 100, boss: true,
    brief: "The Fortress boss. Watch a serial bitstream `x` (one bit per clock) and raise `z` for one cycle every time the pattern 1-0-1 completes. Overlaps count: the stream `10101` contains two matches.\n\nBuild the Moore machine from this exact transition table (states encode progress through the pattern):\n\nUse 2-bit state encoding with `localparam S0 = 2'd0, S1 = 2'd1, S2 = 2'd2, S3 = 2'd3;`. The three-block pattern is strongly recommended here — state register, next-state `case` in `always @(*)` (give `next` a default!), and `assign z = (state == S3);`. Reset puts you in S0.",
    table: {
      cols: ['State', 'has seen', 'x=0 →', 'x=1 →', 'z'],
      rows: [
        ['S0', 'nothing', 'S0', 'S1', '0'],
        ['S1', '1', 'S2', 'S1', '0'],
        ['S2', '10', 'S0', 'S3', '0'],
        ['S3', '101 ✓', 'S2', 'S1', '1'],
      ]
    },
    iface: { name: 'seq101', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'x', d: 'in', w: 1 }, { n: 'z', d: 'out', w: 1 }] },
    starter: "module seq101(\n  input  clk,\n  input  rst,\n  input  x,\n  output z\n);\n  localparam S0 = 2'd0, S1 = 2'd1, S2 = 2'd2, S3 = 2'd3;\n  reg [1:0] state, next;\n\n  // 1) state register\n\n  // 2) next-state logic (case on state, follow the table)\n  //    tip: start with  next = state;  as a default\n\n  // 3) output decode\n\nendmodule\n",
    hints: ["State register: `always @(posedge clk) state <= rst ? S0 : next;`", "Next-state block: `always @(*) begin next = state; case (state) S0: next = x ? S1 : S0; ... endcase end` — read each row of the table.", "S3's exits are the overlap logic: on 0 you've seen '10' (→S2), on 1 you've seen '1' (→S1). Output: `assign z = (state == S3);`"],
    solution: "module seq101(\n  input  clk,\n  input  rst,\n  input  x,\n  output z\n);\n  localparam S0 = 2'd0, S1 = 2'd1, S2 = 2'd2, S3 = 2'd3;\n  reg [1:0] state, next;\n\n  always @(posedge clk) begin\n    if (rst) state <= S0;\n    else     state <= next;\n  end\n\n  always @(*) begin\n    next = state;\n    case (state)\n      S0: next = x ? S1 : S0;\n      S1: next = x ? S1 : S2;\n      S2: next = x ? S3 : S0;\n      S3: next = x ? S1 : S2;\n      default: next = S0;\n    endcase\n  end\n\n  assign z = (state == S3);\nendmodule\n",
    test: {
      type: 'seq', watch: ['z'],
      frames: [{ rst: 1, x: 0 }, { rst: 0, x: 1 }, { rst: 0, x: 0 }, { rst: 0, x: 1 }, { rst: 0, x: 0 }, { rst: 0, x: 1 }, { rst: 0, x: 1 }, { rst: 0, x: 0 }, { rst: 0, x: 1 }, { rst: 0, x: 0 }, { rst: 0, x: 0 }, { rst: 0, x: 1 }, { rst: 0, x: 0 }, { rst: 0, x: 1 }, { rst: 1, x: 1 }, { rst: 0, x: 1 }, { rst: 0, x: 0 }, { rst: 0, x: 1 }],
      makeRef: () => ({
        s: 0, step(f) {
          if (f.rst) { this.s = 0; }
          else {
            const x = f.x;
            if (this.s === 0) this.s = x ? 1 : 0;
            else if (this.s === 1) this.s = x ? 1 : 2;
            else if (this.s === 2) this.s = x ? 3 : 0;
            else this.s = x ? 1 : 2;
          }
          return { z: this.s === 3 ? 1 : 0 };
        }
      })
    }
  },
];
