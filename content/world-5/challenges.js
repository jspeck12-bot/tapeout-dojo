export const CODE_CHALLENGES = [
  {
    id: 's1', world: 5, title: 'The D Flip-Flop', xp: 50,
    brief: "One bit of memory. On every rising clock edge, `q` captures whatever `d` holds at that instant — and ignores `d` completely between edges.\n\nThis is your first `always @(posedge clk)` block. Inside it, the law of the Tower applies: assignments use non-blocking `<=`. Notice `q` is declared `output reg` — anything written inside an always block must be a reg.",
    iface: { name: 'dff', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'd', d: 'in', w: 1 }, { n: 'q', d: 'out', w: 1 }] },
    starter: "module dff(\n  input      clk,\n  input      d,\n  output reg q\n);\n  // capture d on the rising edge\n\nendmodule\n",
    hints: ["Block shape: `always @(posedge clk) begin ... end`", "Inside: `q <= d;` — non-blocking, like all clocked logic."],
    solution: "module dff(\n  input      clk,\n  input      d,\n  output reg q\n);\n  always @(posedge clk) begin\n    q <= d;\n  end\nendmodule\n",
    test: {
      type: 'seq', watch: ['q'],
      frames: [{ d: 1 }, { d: 0 }, { d: 1 }, { d: 1 }, { d: 0 }, { d: 0 }, { d: 1 }, { d: 0 }],
      makeRef: () => ({ q: 0, step(f) { this.q = f.d; return { q: this.q }; } })
    }
  },
  {
    id: 's2', world: 5, title: 'Reset Protocol', xp: 50,
    brief: "Real flip-flops wake up holding garbage, so real designs have a reset. Build a DFF with synchronous reset: on the clock edge, if `rst` is 1, `q` goes to 0 — overriding everything. Otherwise, `q` captures `d` as usual.\n\nReset checks come first in the if-chain. Always.",
    iface: { name: 'dff_rst', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'd', d: 'in', w: 1 }, { n: 'q', d: 'out', w: 1 }] },
    starter: "module dff_rst(\n  input      clk,\n  input      rst,\n  input      d,\n  output reg q\n);\n  // rst wins; otherwise capture d\n\nendmodule\n",
    hints: ["`if (rst) q <= 1'b0; else q <= d;` inside the clocked block.", "Both branches use `<=` — it's still clocked logic on both paths."],
    solution: "module dff_rst(\n  input      clk,\n  input      rst,\n  input      d,\n  output reg q\n);\n  always @(posedge clk) begin\n    if (rst) q <= 1'b0;\n    else     q <= d;\n  end\nendmodule\n",
    test: {
      type: 'seq', watch: ['q'],
      frames: [{ rst: 1, d: 1 }, { rst: 0, d: 1 }, { rst: 0, d: 0 }, { rst: 0, d: 1 }, { rst: 1, d: 1 }, { rst: 0, d: 1 }, { rst: 0, d: 0 }],
      makeRef: () => ({ q: 0, step(f) { this.q = f.rst ? 0 : f.d; return { q: this.q }; } })
    }
  },
  {
    id: 's3', world: 5, title: 'The Enable Gate', xp: 50,
    brief: "A register that only listens when told to. Add an enable: if `rst`, clear; else if `en`, capture `d`; otherwise... write nothing.\n\nThat missing else is the lesson: an unassigned flip-flop holds its value. In the Tower, silence means memory — the exact opposite of the Canyon, where silence meant a latch bug.",
    iface: { name: 'dff_en', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'en', d: 'in', w: 1 }, { n: 'd', d: 'in', w: 1 }, { n: 'q', d: 'out', w: 1 }] },
    starter: "module dff_en(\n  input      clk,\n  input      rst,\n  input      en,\n  input      d,\n  output reg q\n);\n  // rst > en > hold\n\nendmodule\n",
    hints: ["Chain it: `if (rst) ... else if (en) ...` — and stop there.", "No final else needed. The register holds automatically when nothing assigns it."],
    solution: "module dff_en(\n  input      clk,\n  input      rst,\n  input      en,\n  input      d,\n  output reg q\n);\n  always @(posedge clk) begin\n    if (rst)     q <= 1'b0;\n    else if (en) q <= d;\n  end\nendmodule\n",
    test: {
      type: 'seq', watch: ['q'],
      frames: [{ rst: 1, en: 0, d: 1 }, { rst: 0, en: 1, d: 1 }, { rst: 0, en: 0, d: 0 }, { rst: 0, en: 0, d: 0 }, { rst: 0, en: 1, d: 0 }, { rst: 0, en: 1, d: 1 }, { rst: 0, en: 0, d: 0 }, { rst: 1, en: 1, d: 1 }],
      makeRef: () => ({ q: 0, step(f) { if (f.rst) this.q = 0; else if (f.en) this.q = f.d; return { q: this.q }; } })
    }
  },
  {
    id: 's4', world: 5, title: 'The Counter', xp: 60,
    brief: "A register plus an adder in a feedback loop — suddenly the circuit does something over time. Build a 4-bit counter: reset to 0, otherwise add 1 every clock edge.\n\nDon't handle the wrap. At 15, `q + 1` overflows the 4-bit register and rolls to 0 on its own. The hardware's limitation is the feature.",
    iface: { name: 'counter4', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'q', d: 'out', w: 4 }] },
    starter: "module counter4(\n  input            clk,\n  input            rst,\n  output reg [3:0] q\n);\n  // 0,1,2,...,15,0,...\n\nendmodule\n",
    hints: ["`q <= q + 1;` — the right side reads the pre-edge value, the register captures the new one.", "`if (rst) q <= 4'd0; else q <= q + 1;`"],
    solution: "module counter4(\n  input            clk,\n  input            rst,\n  output reg [3:0] q\n);\n  always @(posedge clk) begin\n    if (rst) q <= 4'd0;\n    else     q <= q + 1;\n  end\nendmodule\n",
    test: {
      type: 'seq', watch: ['q'],
      frames: [{ rst: 1 }, { rst: 0 }, { rst: 0 }, { rst: 0 }, { rst: 0 }, { rst: 1 }, { rst: 0 }, { rst: 0 }].concat(Array.from({ length: 15 }, () => ({ rst: 0 }))),
      makeRef: () => ({ q: 0, step(f) { this.q = f.rst ? 0 : (this.q + 1) % 16; return { q: this.q }; } })
    }
  },
  {
    id: 's5', world: 5, title: 'Shift Register', xp: 60,
    brief: "Serial in, parallel out. Each clock, the 4-bit register slides left one position and the new bit `sin` enters at the bottom: `q` becomes `{q[2:0], sin}`.\n\nFour clocks of serial bits become one 4-bit word — this is how UARTs, SPI, and shift-chain debug ports move every byte they've ever moved. Reset clears to 0.",
    iface: { name: 'shifter', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'sin', d: 'in', w: 1 }, { n: 'q', d: 'out', w: 4 }] },
    starter: "module shifter(\n  input            clk,\n  input            rst,\n  input            sin,\n  output reg [3:0] q\n);\n  // slide left, sin enters at bit 0\n\nendmodule\n",
    hints: ["Concatenation builds the next value: keep the low 3 bits, append sin.", "`q <= {q[2:0], sin};` — old bit 3 falls off the top."],
    solution: "module shifter(\n  input            clk,\n  input            rst,\n  input            sin,\n  output reg [3:0] q\n);\n  always @(posedge clk) begin\n    if (rst) q <= 4'd0;\n    else     q <= {q[2:0], sin};\n  end\nendmodule\n",
    test: {
      type: 'seq', watch: ['q'],
      frames: [{ rst: 1, sin: 0 }, { rst: 0, sin: 1 }, { rst: 0, sin: 0 }, { rst: 0, sin: 1 }, { rst: 0, sin: 1 }, { rst: 0, sin: 0 }, { rst: 0, sin: 1 }, { rst: 1, sin: 1 }, { rst: 0, sin: 1 }, { rst: 0, sin: 1 }],
      makeRef: () => ({ q: 0, step(f) { this.q = f.rst ? 0 : ((this.q * 2 + f.sin) % 16); return { q: this.q }; } })
    }
  },
  {
    id: 's6', world: 5, title: 'Up / Down Counter', xp: 60,
    brief: "One register, two personalities. When `dir` is 1, count up; when `dir` is 0, count down. Reset still clears to 0.\n\nWatch the wrap in both directions: 15 + 1 → 0, and 0 − 1 → 15. Two's complement handles the underflow without you lifting a finger — this is the odometer from World 1, running in silicon.",
    iface: { name: 'updown', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'dir', d: 'in', w: 1 }, { n: 'q', d: 'out', w: 4 }] },
    starter: "module updown(\n  input            clk,\n  input            rst,\n  input            dir,\n  output reg [3:0] q\n);\n  // dir=1: q+1, dir=0: q-1\n\nendmodule\n",
    hints: ["A ternary inside the non-blocking assignment keeps it to one line: `q <= dir ? q + 1 : q - 1;`", "Full chain: `if (rst) q <= 4'd0; else q <= dir ? q + 1 : q - 1;`"],
    solution: "module updown(\n  input            clk,\n  input            rst,\n  input            dir,\n  output reg [3:0] q\n);\n  always @(posedge clk) begin\n    if (rst) q <= 4'd0;\n    else     q <= dir ? q + 1 : q - 1;\n  end\nendmodule\n",
    test: {
      type: 'seq', watch: ['q'],
      frames: [{ rst: 1, dir: 1 }, { rst: 0, dir: 1 }, { rst: 0, dir: 1 }, { rst: 0, dir: 1 }, { rst: 0, dir: 0 }, { rst: 0, dir: 0 }, { rst: 0, dir: 0 }, { rst: 0, dir: 0 }, { rst: 0, dir: 0 }, { rst: 0, dir: 1 }, { rst: 1, dir: 0 }, { rst: 0, dir: 0 }],
      makeRef: () => ({ q: 0, step(f) { this.q = f.rst ? 0 : (f.dir ? (this.q + 1) % 16 : (this.q + 15) % 16); return { q: this.q }; } })
    }
  },
  {
    id: 's7', world: 5, title: 'BOSS · Saturating Counter', xp: 80, boss: true,
    brief: "The Tower's keeper. A counter with manners: it counts up while `en` is high, but when it reaches 15 it stays there — no wraparound. Reset clears to 0; with `en` low, it holds.\n\nSaturating counters are real workhorses: branch predictors in CPUs are built from millions of 2-bit versions of exactly this. Your priority chain: reset, then enable, and inside the enabled path, a saturation check (`q == 4'd15` ... or `q < 4'd15`, or `&q` — many roads up the tower).",
    iface: { name: 'sat_counter', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'en', d: 'in', w: 1 }, { n: 'q', d: 'out', w: 4 }] },
    starter: "module sat_counter(\n  input            clk,\n  input            rst,\n  input            en,\n  output reg [3:0] q\n);\n  // count to 15 and hold\n\nendmodule\n",
    hints: ["Structure: `if (rst) ... else if (en) ...` — hold-when-disabled is free.", "Inside the enable: only increment if not yet at max. A ternary works: `q <= (q == 4'd15) ? q : q + 1;`", "Reduction AND is a slick max-check: `&q` is 1 exactly when all bits are 1."],
    solution: "module sat_counter(\n  input            clk,\n  input            rst,\n  input            en,\n  output reg [3:0] q\n);\n  always @(posedge clk) begin\n    if (rst)     q <= 4'd0;\n    else if (en) q <= (q == 4'd15) ? q : q + 1;\n  end\nendmodule\n",
    test: {
      type: 'seq', watch: ['q'],
      frames: [{ rst: 1, en: 0 }].concat(Array.from({ length: 17 }, () => ({ rst: 0, en: 1 }))).concat([{ rst: 0, en: 0 }, { rst: 0, en: 1 }, { rst: 1, en: 1 }, { rst: 0, en: 1 }, { rst: 0, en: 0 }]),
      makeRef: () => ({ q: 0, step(f) { if (f.rst) this.q = 0; else if (f.en && this.q < 15) this.q = this.q + 1; return { q: this.q }; } })
    }
  },
];
