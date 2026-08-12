// ============================================================
// CONTENT — worlds, lessons, challenges, arcade, achievements
// ============================================================

// ---------- utilities ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function rPick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function toBin(v, w) {
  let s = (v >>> 0).toString(2).padStart(w, '0');
  if (w === 8) s = s.slice(0, 4) + '_' + s.slice(4);
  if (w === 16) s = s.match(/.{4}/g).join('_');
  return s;
}
function toHex(v, w) { return (v >>> 0).toString(16).toUpperCase().padStart(Math.ceil(w / 4), '0'); }
function normNum(str) { return (str || '').trim().toLowerCase().replace(/[\s_]/g, ''); }
function checkDec(target) {
  return (s) => {
    const t = normNum(s).replace(/^\+/, '');
    if (!/^-?\d+$/.test(t)) return false;
    return parseInt(t, 10) === target;
  };
}
function checkBin(target) {
  return (s) => {
    let t = normNum(s).replace(/^0b/, '').replace(/^'b/, '');
    if (!/^[01]+$/.test(t) || t.length > 33) return false;
    return parseInt(t, 2) === target;
  };
}
function checkHex(target) {
  return (s) => {
    let t = normNum(s).replace(/^0x/, '').replace(/^'h/, '');
    if (!/^[0-9a-f]+$/.test(t)) return false;
    return parseInt(t, 16) === target;
  };
}
function checkBinOrHex(target) {
  const b = checkBin(target), h = checkHex(target);
  return (s) => {
    const t = normNum(s);
    if (/^(0b|'b)/.test(t)) return b(s);
    if (/^(0x|'h)/.test(t)) return h(s);
    if (/^[01]+$/.test(t) && t.length >= 4) return b(s);
    return h(s) || b(s);
  };
}

// ---------- worlds ----------
const WORLDS = [
  { id: 1, key: 'mines', name: 'The Bit Mines', tag: 'Number Systems', color: '#F5B14C', desc: 'Every chip is built from two rocks: 0 and 1. Learn to read the ore.' },
  { id: 2, key: 'valley', name: 'Gate Valley', tag: 'Logic Gates & Boolean Algebra', color: '#A3E635', desc: 'Seven gates guard the valley. Master their truth tables and the laws that bind them.' },
  { id: 3, key: 'foundry', name: 'Module Foundry', tag: 'First Verilog', color: '#22D3EE', desc: 'The editor unlocks. Write real Verilog, compile it, and run it against silicon-grade tests.' },
  { id: 4, key: 'canyon', name: 'Combinational Canyon', tag: 'Muxes, Adders, Decoders', color: '#FB923C', desc: 'Pure logic, no memory. Build the structures every datapath is made of.' },
  { id: 5, key: 'tower', name: 'The Clock Tower', tag: 'Sequential Logic', color: '#A78BFA', desc: 'Time enters the design. Flip-flops, registers, counters — circuits that remember.' },
  { id: 6, key: 'fortress', name: 'FSM Fortress', tag: 'Finite State Machines', color: '#FB7185', desc: 'Machines that make decisions. The architecture behind every controller ever shipped.' },
  { id: 7, key: 'tapeout', name: 'TAPEOUT', tag: 'Final Boss', color: '#FACC15', desc: 'One module. One shot. Ship the chip.' },
];

// ---------- lessons ----------
const LESSONS = {
  1: [
    {
      id: 'L1a', title: 'Why binary?', body:
        "A transistor is a switch: on or off. That's the entire alphabet of hardware — 1 and 0. Everything a chip does (your GPU rendering a frame, an autopilot computing thrust) is built by stacking billions of these two-letter decisions.\n\nBinary is just place value with base 2. Each position is worth double the last: 8·4·2·1. So `1011` = 8 + 0 + 2 + 1 = 11. Read right-to-left, doubling as you go. That's the whole trick."
    },
    {
      id: 'L1b', title: 'Hex: binary with the boring parts compressed', body:
        "Nobody wants to read `1101_0110_1111_0001`. Hexadecimal packs every 4 bits (a nibble) into one digit: 0–9, then A–F for 10–15.\n\n`1101` = D, `0110` = 6. So `1101_0110` = `0xD6`. Conversion is per-nibble — you never need math across the boundary. Memorize a few anchors: `A=1010`, `C=1100`, `F=1111`, and you can sight-read memory dumps like an engineer.",
      code: "8'b1101_0110  ==  8'hD6  ==  8'd214"
    },
    {
      id: 'L1c', title: "Two's complement: negatives without a minus sign", body:
        "Hardware has no minus key. The fix: make the top bit negative. In 8 bits, the MSB is worth −128 instead of +128. So `1111_0110` = −128 + 64 + 32 + 16 + 4 + 2 = −10.\n\nTo negate any number: invert every bit, add 1. It works like a car odometer rolling backwards past zero — 0 − 1 wraps to `1111_1111` (−1). Best part: the adder circuit doesn't change at all. Subtraction is just addition with the second operand negated. One circuit, both jobs.",
      code: "  42 = 0010_1010\n  ~  = 1101_0101   (invert)\n  +1 = 1101_0110   = -42  (0xD6)"
    },
    {
      id: 'L1d', title: 'Range and overflow', body:
        "N bits in two's complement cover −2^(n−1) to 2^(n−1)−1. For 8 bits: −128 to +127. Notice the asymmetry — there's one more negative number than positive.\n\nOverflow happens when a result falls outside that range: 127 + 1 wraps to −128. The tell: adding two numbers with the same sign and getting a result with the opposite sign. Adding numbers of different signs can never overflow. Real bugs (and at least one exploded rocket) live here."
    },
  ],
  2: [
    {
      id: 'L2a', title: 'The gate zoo', body:
        "Gates are functions on bits. The big seven:\n\nAND (`&`) — 1 only if all inputs are 1. OR (`|`) — 1 if any input is 1. NOT (`~`) — flips the bit. XOR (`^`) — 1 if inputs differ (it's literally 1-bit addition without carry). NAND, NOR, XNOR — the first three with a NOT bolted on.\n\nA truth table is a gate's complete biography: every input combo, every output. Two inputs → 4 rows. Three inputs → 8 rows. If two circuits have the same truth table, they ARE the same circuit, no matter how differently they're drawn."
    },
    {
      id: 'L2b', title: 'NAND runs the world', body:
        "NAND (and NOR) are universal: any circuit — any CPU — can be built from NAND gates alone. Tie a NAND's inputs together and it becomes a NOT. Feed that into another NAND and you have AND. Stack from there.\n\nWhy care? In CMOS silicon, NAND is the cheapest, fastest gate you can lay out. Synthesis tools quietly translate your elegant Verilog into oceans of NANDs. You write intent; the fab prints NAND."
    },
    {
      id: 'L2c', title: "De Morgan's law: pushing bubbles", body:
        "The most-used identity in digital design:\n\n`~(A & B) = ~A | ~B`\n`~(A | B) = ~A & ~B`\n\nBreak the bar, flip the operator. Engineers call it bubble pushing — slide the inversion bubble through a gate and AND⇄OR swap. It's how you convert designs into all-NAND form, and how you read schematics where someone drew an OR with inverted inputs (that's just a NAND in a trench coat)."
    },
    {
      id: 'L2d', title: 'Boolean cleanup rules', body:
        "Simplification = fewer gates = cheaper, faster, cooler silicon. The identities worth knowing cold:\n\n`A & 1 = A` and `A & 0 = 0` — AND gates pass or kill.\n`A | 0 = A` and `A | 1 = 1` — OR gates pass or force.\n`A & ~A = 0`, `A | ~A = 1` — a signal can't disagree with itself.\n`A ^ A = 0`, `A ^ 1 = ~A` — XOR is a controllable inverter.\n`A | (A & B) = A` — absorption: the bigger term eats the smaller.\n\nThese aren't trivia. Synthesis tools apply them millions of times per build."
    },
  ],
  3: [
    {
      id: 'L3a', title: 'Anatomy of a module', body:
        "A module is a chip-in-a-box: a name, ports (the pins), and a body (the logic). Everything in Verilog lives inside one.\n\nPorts are declared with a direction and an optional width. One golden rule before you write a single line of logic: you are not writing a program — you are describing hardware that all exists at once. There is no top-to-bottom execution. Every statement is a physical structure, live simultaneously, forever.",
      code: "module my_gate(\n  input  a,\n  input  b,\n  output y\n);\n  // logic goes here\nendmodule"
    },
    {
      id: 'L3b', title: 'assign: permanent wiring', body:
        "`assign y = a & b;` doesn't run — it solders. It creates a continuous connection: whenever `a` or `b` changes, `y` updates instantly, always, like a real wire welded to a real gate.\n\nThe operators map straight to gates: `&` AND, `|` OR, `^` XOR, `~` NOT. Combine freely: `assign y = ~(a & b);` is a NAND. Parentheses work like math. One constraint: a wire can have exactly one driver — two assigns to the same wire is a short circuit.",
      code: "assign sum   = a ^ b;     // XOR\nassign carry = a & b;     // AND\nassign nnd   = ~(a & b);  // NAND"
    },
    {
      id: 'L3c', title: 'Buses: many bits, one name', body:
        "`wire [3:0] data;` is four wires in a labeled bundle — bit 3 down to bit 0 (MSB first, by convention).\n\nGrab one bit with `data[2]`, a slice with `data[3:1]`. Glue things together with concatenation: `{a, b}` stacks a on top of b. Operators apply bitwise across whole buses: `a & b` on two 4-bit buses is four AND gates working in parallel.",
      code: "wire [7:0] w;\nassign w = {4'b1010, 4'b0101};  // w = 8'hA5\nassign top = w[7];              // MSB\nassign lo4 = w[3:0];            // low nibble"
    },
    {
      id: 'L3d', title: 'Literals: say exactly what you mean', body:
        "`4'b1010` reads as: 4 bits, binary, value 1010. The format is width 'base value. Bases: `b` binary, `h` hex, `d` decimal.\n\nUnderscores are free candy for readability: `8'b1101_0110`. A bare number like `5` works but defaults to 32 bits wide — fine for counters, sloppy for buses. Sized literals are the professional habit: they say exactly how many wires you mean.",
      code: "4'b1010   // 10\n8'hFF     // 255\n8'd200    // 200\n1'b1      // a single high bit"
    },
  ],
  4: [
    {
      id: 'L4a', title: "The mux: hardware's if-statement", body:
        "A multiplexer picks one of several inputs using a select signal. In Verilog it's the ternary operator:\n\n`assign y = sel ? a : b;` — when `sel` is 1, y follows a; otherwise b.\n\nMuxes are everywhere: register file reads, ALU result selection, bypass paths. Nest them for more inputs, or use a `case` inside `always @(*)` when nesting gets ugly. Either way, the synthesized hardware is the same tree of muxes.",
      code: "// 4:1 mux from nested ternaries\nassign y = sel[1] ? (sel[0] ? d3 : d2)\n                  : (sel[0] ? d1 : d0);"
    },
    {
      id: 'L4b', title: 'Adders: where carry comes from', body:
        "A half adder adds two bits: `sum = a ^ b`, `carry = a & b`. XOR is the sum, AND is the carry — burn that in.\n\nA full adder takes a carry-in too: `sum = a ^ b ^ cin`, `cout = a&b | cin&(a^b)`. Chain full adders and you get a ripple-carry adder. In Verilog you can skip the manual chain — `a + b` synthesizes the whole thing. The trick is catching the carry: the sum of two 4-bit numbers needs 5 bits.",
      code: "wire [3:0] a, b;\nwire [3:0] sum;\nwire       cout;\nassign {cout, sum} = a + b;  // 5-bit result, split"
    },
    {
      id: 'L4c', title: 'Decoders and one-hot', body:
        "A decoder turns a binary code into a single fired line: 2 bits in, one of 4 lines high. `a = 2'b10` → `y = 4'b0100`. That output style is called one-hot — exactly one bit set.\n\nThe slick implementation: shift a 1 left by the input value: `assign y = 4'b0001 << a;`. Decoders drive memory row selects, register enables, and instruction decode — any time a number must choose a physical destination."
    },
    {
      id: 'L4d', title: 'always @(*): combinational, but roomier', body:
        "For logic too gnarly for one assign, use a combinational always block.\n\n`always @(*)` means re-evaluate whenever any input changes — still just gates, no memory. Inside, use blocking `=` and drive only reg-declared signals (a Verilog naming quirk: `reg` here does NOT mean register).\n\nThe latch trap: every path through the block must set every output. An `if` with no `else` means \"sometimes, keep the old value\" — and keeping a value requires memory, so the tools infer an accidental latch. Always cover every case; `default:` is your friend.",
      code: "always @(*) begin\n  case (sel)\n    2'd0: y = a;\n    2'd1: y = b;\n    default: y = 1'b0;  // no latches today\n  endcase\nend"
    },
  ],
  5: [
    {
      id: 'L5a', title: 'The D flip-flop: one bit of memory', body:
        "Everything so far reacts instantly. A flip-flop waits. It ignores its input until the clock's rising edge, then snapshots D into Q and holds it — a camera that only fires on the beat.\n\n`always @(posedge clk) q <= d;`\n\nThat one line is the atom of all state: registers, counters, your GPU's pipeline — trillions of these, all blinking in unison at every edge. The clock is the heartbeat that turns frozen logic into computation over time."
    },
    {
      id: 'L5b', title: '<= vs = : the rule that saves careers', body:
        "Non-blocking `<=` means: evaluate every right-hand side first, then update all registers simultaneously — exactly how real flip-flops behave on a shared clock edge.\n\nThe law: clocked blocks use `<=`, combinational blocks use `=`. Mix them and your simulation lies to you about the silicon.\n\nProof it matters — a 2-stage shift register: with `<=`, b gets a's old value (correct: two stages). With `=`, a updates first and b copies the new value — your two registers silently collapse into one.",
      code: "always @(posedge clk) begin\n  a <= d;   // both sample the\n  b <= a;   // pre-edge values:\nend         // a real 2-stage delay"
    },
    {
      id: 'L5c', title: 'Reset and enable', body:
        "Power-on values are garbage, so registers get a reset: `if (rst) q <= 0; else ...`. Checked inside the clocked block (synchronous reset), it wins over everything else.\n\nAn enable gates updates: `else if (en) q <= d;` — and here's the beautiful part: you don't write \"else hold.\" A flip-flop that isn't assigned keeps its value automatically. That's memory doing its job. (Contrast with combinational blocks, where a missing else is a latch bug. Same syntax, opposite meaning — because one world has memory and one doesn't.)",
      code: "always @(posedge clk) begin\n  if (rst)      q <= 4'd0;\n  else if (en)  q <= d;\n  // no else: q holds.\nend"
    },
    {
      id: 'L5d', title: 'Counters and shifters: registers with feedback', body:
        "Feed a register's output back through logic into its input and it evolves every cycle.\n\nCounter: `q <= q + 1;` — the +1 is an adder sitting between Q and D. Width sets the wrap: 4 bits roll over at 15→0, free of charge.\n\nShift register: `q <= {q[2:0], sin};` — slide everything left, new bit enters at position 0. Four cycles of serial input become one parallel word. This is how UARTs, SPI, and every serial protocol you've ever used actually move data.",
      code: "always @(posedge clk) begin\n  count <= count + 1;          // wraps at 15\n  shreg <= {shreg[2:0], sin};  // serial in\nend"
    },
  ],
  6: [
    {
      id: 'L6a', title: 'What a state machine is', body:
        "An FSM is a register holding a state, plus combinational logic deciding the next state from current state + inputs. That's it — but it's the pattern behind every controller: traffic lights, USB handshakes, your microwave, the control unit of a CPU.\n\nMoore machines: outputs depend only on the state (clean, glitch-free). Mealy machines: outputs depend on state and current inputs (faster reaction, twitchier). The Dojo builds Moore — it's the style you'll reach for 90% of the time."
    },
    {
      id: 'L6b', title: 'The three-block pattern', body:
        "Professional FSM code separates three jobs:\n\n1. State register — clocked, with reset.\n2. Next-state logic — combinational case on the state, reading inputs.\n3. Output logic — usually a simple assign decoded from state.\n\nName your states with `localparam` so the code reads like the state diagram. Mixing these blocks together works... until the FSM grows and it very much doesn't.",
      code: "localparam IDLE = 1'd0, RUN = 1'd1;\nreg state, next;\n\nalways @(posedge clk)\n  state <= rst ? IDLE : next;\n\nalways @(*) begin\n  next = state;          // safe default\n  case (state)\n    IDLE: if (go)   next = RUN;\n    RUN:  if (stop) next = IDLE;\n  endcase\nend\n\nassign running = (state == RUN);"
    },
    {
      id: 'L6c', title: 'Sequence detectors: remembering the past', body:
        "How does hardware spot the pattern 101 sliding by on a 1-bit-per-cycle stream? It can't store the stream — it stores how much of the pattern it has seen so far. Each state = a milestone: \"seen 1\", \"seen 10\", \"seen 101 — fire!\"\n\nThe sneaky part is overlap: after detecting 101, the trailing 1 might be the start of the next match. So the detect state doesn't return to start — it jumps to \"seen 1\". Getting those backtrack edges right is the whole puzzle, and it's exactly what the Fortress boss will test."
    },
  ],
  7: [
    {
      id: 'L7a', title: 'Briefing: the accumulator machine', body:
        "Every CPU descends from one idea: a register (the accumulator) that an ALU repeatedly folds new values into. `acc = acc OP b`, once per clock. Load, add, subtract, mask — that loop, scaled up and pipelined, is a processor.\n\nYour final build is exactly this: a 4-bit ALU (add / sub / AND / OR, chosen by a 2-bit opcode) feeding an accumulator register with synchronous reset. Combinational world + sequential world, fused. Everything from six worlds, on one die."
    },
    {
      id: 'L7b', title: 'Why this is called tapeout', body:
        "When a chip design is finished and verified, the final layout is sent to the fab for manufacturing. Decades ago it shipped on actual magnetic tape — so the moment is still called tapeout. It's the point of no return: after tapeout, a bug costs millions and months.\n\nWhich is why verification — the tests your code has been sweating through all game — is half of all chip engineering. Pass the testbench below and you've earned the word."
    },
  ],
};

// Phase: deeper field notes. A "going deeper" layer per lesson — the next layer a sharp
// student wants after the basics: real-silicon consequences, worked detail, pro gotchas.
// Rendered after the lesson body at every field-note site. Keyed by lesson id.
const LESSON_DEPTH = {
  L1a: "Why exactly two levels and not ten? Noise. A real wire picks up interference, and if '3' meant 0.3V while '4' meant 0.4V, the smallest disturbance would corrupt a digit. With only two levels and a wide forbidden gap between them, noise has to clear a huge margin before a bit actually flips — that noise margin is why digital circuits stay reliable while analog ones drift. Your GPU sustains billions of operations per second precisely because every gate only ever decides 'high or low,' never 'how high.'",
  L1b: "Why nibbles specifically? Hardware is organized in powers of two, and 4 bits is the cleanest chunk a human can read at a glance. When you debug a real chip you read register fields in hex: a 32-bit control register might pack an 8-bit ID, a 4-bit mode, and a pile of flags, and hex lets you see each nibble-aligned field without counting bits. Masks live in hex too — `& 0x0F` keeps the low nibble, `& 0xF0` keeps the high one. Sight-reading hex is a daily skill in firmware and driver work.",
  L1c: "The deep reason two's complement works: it is arithmetic modulo 2^n. In 8 bits every value lives on a ring of 256 positions, and we simply relabel the top half as negative. Because addition on that ring wraps automatically, -42 (`0xD6`) plus 50 gives 8 with no special handling — the carry off the top just falls away. It is also why sign extension works: to widen a negative number you copy the sign bit leftward and the value is preserved. One adder, one ring, no minus key.",
  L1d: "Carry and overflow are different flags, and confusing them causes real bugs. Carry-out is about unsigned math — did the result exceed the unsigned max? Overflow is about signed math — did the sign come out wrong? Hardware computes overflow as the XOR of the carry into the MSB and the carry out of it: if those disagree, the sign bit got corrupted. A CPU sets both flags on every add, and your code decides which one matters based on whether you are treating the bits as signed or unsigned.",
  L2a: "Gates are neither free nor equal. In CMOS an inverter is 2 transistors and a 2-input NAND is 4, but a 2-input XOR runs closer to 8-12 because it needs internal inversions — which is why adders, full of XORs, are bigger and slower than the boolean equation suggests. Every gate also carries a propagation delay, and enough of them in series form the critical path that caps your clock speed. When you write `a ^ b ^ c`, the synthesizer is quietly counting transistors and nanoseconds.",
  L2b: "Why NAND rules in silicon: CMOS gates are naturally inverting. A NAND is just PMOS transistors in parallel pulling up and NMOS in series pulling down — compact and fast — whereas a non-inverting AND is literally a NAND followed by an inverter and therefore costs more. That is why standard-cell libraries are built around NAND, NOR, and inverters, and why synthesis tools 'think' in those terms. You write intent in Verilog; the tool maps it to an ocean of these inverting cells.",
  L2c: "Bubble pushing is how real designs get flattened to one gate type. Since CMOS prefers inverting gates, tools repeatedly apply De Morgan to convert your AND/OR mix into all-NAND or all-NOR form. It is also how you read schematics from old-school engineers: an OR gate drawn with bubbles on its inputs is, by De Morgan, just a NAND — same silicon, different drawing. Libraries even ship fused AOI (and-or-invert) and OAI cells that pack a whole bubble-pushed expression into a single compact gate.",
  L2d: "These identities are exactly what logic synthesis automates, millions of times per build. The classic hand tool is the Karnaugh map, which makes absorption and complementary terms visually obvious; modern tools use algorithms like Espresso instead. The payoff is concrete — fewer literals means fewer transistors, shorter critical paths, and lower power. 'Don't-care' conditions, input combinations that can never occur, are gold here: the tool is free to assign them whatever value simplifies the logic most.",
  L3a: "'Everything exists at once' is the hardest shift coming from software. There is no program counter walking your module line by line — every `assign` and every gate is a physical structure that is powered and live continuously, so two statements in any order describe the same circuit. Real chips are built from a hierarchy of these boxes — a CPU instantiates ALUs, which instantiate adders — though the dojo keeps you to one self-contained module so you focus on the logic, not the wiring.",
  L3b: "`assign` builds combinational logic: the output is a pure function of current inputs, recomputed instantly and forever. The one-driver rule is not style advice — two assigns fighting over one wire is a physical short, and simulators show it as `x` (unknown). This is also the `wire` vs `reg` line: `assign` drives a `wire`, while anything assigned inside an `always` block must be a `reg`. Getting that wrong is the most common beginner error, and the compiler will stop you on it immediately.",
  L3c: "`[3:0]` versus `[0:3]` is endianness, and mixing conventions causes silent bit-reversal bugs — pick MSB-first (`[N-1:0]`) and never deviate. Part-selects and concatenation are free: `w[3:0]` and `{a, b}` are just relabeled wires, no gates involved. Replication is the handy one for sign extension and masks — `{8{sign}}` makes eight copies of a bit, so `{ {4{w[3]}}, w }` sign-extends a nibble to a byte in a single expression.",
  L3d: "Width matters more than beginners expect. Assign a 5-bit result to a 4-bit wire and the top bit is silently truncated; assign a small value to a wide bus and it zero-extends. A bare `5` is 32 bits wide, which causes surprises in concatenations and comparisons, so pros size every literal (`4'd5`) to make the wire count explicit and self-documenting. Verilog also has `x` for unknown and `z` for high-impedance — you will meet `z` the day you build a bidirectional bus.",
  L4a: "Muxes are the universal building block. Any truth table can be built as a tree of muxes, which is exactly what an FPGA does — its 'logic' is really lookup tables, and a LUT is just a mux with the truth table stored on its select lines. In a CPU, muxes choose the ALU operation, pick which register to read, and route bypass paths. One caution: a chain of `if/else` synthesizes to a priority mux (ordered, slower), while a `case` can become a flat parallel mux — the structure you describe is the structure you get.",
  L4b: "`a + b` hides a real architectural choice. The naive build is a ripple-carry adder, where the carry walks bit by bit, so delay grows linearly with width and a 64-bit ripple adder is painfully slow. Real chips use carry-lookahead, carry-select, or prefix adders like Kogge-Stone that compute carries in parallel, trading area for speed. The synthesizer picks the architecture to hit your timing constraint — which is why the same `+` can become a small slow adder or a big fast one depending on the clock you ask for.",
  L4c: "One-hot is everywhere once you see it. Decoders drive memory row and column selects, register-file write enables, and instruction decode — anywhere a binary code must pick one physical destination. One-hot also shows up in FSM state registers because it makes next-state logic trivially fast: one flip-flop per state, no decoding. The `1 << a` shift trick and a `case` synthesize to the same decoder, so pick whichever reads clearer.",
  L4d: "`always @(*)` has one infamous trap: if any output is not assigned on every path, the tool infers a latch to 'remember' the old value — almost never what you want, and a classic source of timing bugs. The fix is discipline — assign every output a default at the top of the block, or make every branch complete. Pre-2001 Verilog forced you to list the sensitivity manually as `@(a or b or sel)`, and forgetting a signal caused sim-versus-synthesis mismatches; `@(*)` exists precisely to kill that bug.",
  L5a: "The D flip-flop is the atom of sequential logic: one bit that samples its input only at the clock edge and holds it the rest of the cycle. For that sample to be reliable the input must be stable for a setup time before the edge and a hold time after; violate that window and the flop can go metastable, hovering between 0 and 1 for an unpredictable time. Managing setup and hold across millions of flops is what static timing analysis is all about. Every register, counter, and state machine is just flip-flops in formation.",
  L5b: "Here is the worked reason `<=` matters. Picture a shift register: `b <= a; c <= b;`. With nonblocking assignment both right-hand sides are read first, using old values, then both registers update together at the edge — so `a` shifts into `b` and the old `b` shifts into `c`, exactly like real hardware. With blocking (`=`), `b` updates to `a` immediately and then `c` gets the new `b`, collapsing two stages into one. The rule that genuinely saves careers: `<=` in clocked (`posedge`) blocks, `=` in combinational (`@(*)`) blocks, never mixed on one signal.",
  L5c: "Reset and enable are where real ASIC discipline shows. Async reset responds instantly, which is good for power-up, but creates timing headaches and complicates testing; sync reset is cleaner for timing but needs a running clock — big chips pick one strategy and enforce it everywhere. An enable is the logical cousin of clock gating: `if (en) q <= d;` lets a register ignore the clock's effect, and the physical version, actually gating the clock, is a top power-saving technique. A register with no reset path can power up as `x`, which is a real bring-up hazard.",
  L5d: "A counter is just an accumulator that always adds 1 — and once you see that, the leap to your capstone accumulator, which adds a variable amount, is small. Shift registers with feedback give you LFSRs, which generate long pseudo-random sequences from a handful of XOR gates, used for test patterns and scramblers. Watch the wrap: a 4-bit counter rolls 15 to 0 silently, and whether that is a feature or a bug is on you. The carry chain inside a counter is the same ripple-versus-fast tradeoff as the adder.",
  L6a: "A finite state machine is memory plus rules: a register holds 'where am I,' and combinational logic decides 'where next' and 'what to output.' The big fork is Moore versus Mealy — Moore outputs depend only on the state (cleaner, glitch-free), Mealy outputs also depend on the current input (fewer states, but outputs can react a cycle earlier). State encoding is a real knob too: binary is compact, one-hot is fast, Gray code minimizes switching power. FSMs run protocols, bus arbiters, and the control unit of every CPU.",
  L6b: "The three-block pattern — state register, next-state logic, output logic — is not dogma; it maps directly onto the hardware (one clocked block for the flops, two combinational blocks for the logic) and keeps synthesis and debugging clean. The next-state block is combinational, so the `always @(*)` latch trap applies: give the next-state variable a default, usually 'stay in the current state,' before the `case`, or you will infer latches. Keeping outputs in their own block makes switching a design between Moore and Mealy trivial.",
  L6c: "A sequence detector is the purest proof that the state IS the memory — you never store past inputs, only 'how much of the pattern have I matched so far.' This is exactly a deterministic finite automaton, the same theory behind regular expressions, and drawing the state diagram before coding is the professional workflow. The subtle design choice is overlapping versus non-overlapping detection: after matching `1011`, does the trailing `1` count as the start of the next match? That single decision reshapes your state graph.",
  L7a: "The accumulator is the beating heart of a datapath: a register that feeds an ALU whose result feeds back into the same register every cycle. That register-compute-register loop is the essential pattern of every processor's execute stage — swap the ALU for add/sub/and/or selected by an opcode and you have built a tiny CPU's arithmetic core. Everything converges here: muxes pick the operation, the adder does the math, two's complement handles subtraction, and a clocked register with reset holds the running total. Build this and you understand the skeleton of a computer.",
  L7b: "'Tapeout' is literal history: layouts once shipped to the fab on magnetic tape, and the name stuck for the moment a design is finalized and sent to manufacturing. The real flow downstream of your Verilog is RTL, then logic synthesis to a gate netlist, then place-and-route where gates become physical rectangles and wires, then GDSII (the geometry file), then photomasks, then silicon. Tiny Tapeout is the hobbyist on-ramp to exactly this flow, sharing one chip across many small designs. The GPUs you are aiming to design run this same pipeline — just with thousands of engineers, billions of transistors, and a months-long, multi-million-dollar mask set riding on getting the RTL right.",
};

// ---------- gauntlet generators ----------
function genB1(rng, i) {
  if (i % 2 === 0) {
    const v = rInt(rng, 1, 15);
    return { text: `Convert binary \`${toBin(v, 4)}\` to decimal.`, check: checkDec(v), answer: String(v), explain: `Weights are 8·4·2·1. Sum the positions holding a 1 → ${v}.` };
  }
  const v = rInt(rng, 1, 15);
  return { text: `Write \`${v}\` in binary (4 bits).`, check: checkBin(v), answer: toBin(v, 4), explain: `Pull out powers of two: ${v} = ${[8, 4, 2, 1].filter(p => v & p).join(' + ')} → ${toBin(v, 4)}.` };
}
function genB2(rng, i) {
  const specials = [255, 128, 170, 85, 200, 64];
  const v = rng() < 0.4 ? rPick(rng, specials) : rInt(rng, 16, 254);
  if (i % 2 === 0) {
    return { text: `Convert binary \`${toBin(v, 8)}\` to decimal.`, check: checkDec(v), answer: String(v), explain: `Weights 128·64·32·16 / 8·4·2·1. Sum the positions holding a 1 → ${v}.` };
  }
  return { text: `Write \`${v}\` in 8-bit binary.`, check: checkBin(v), answer: toBin(v, 8), explain: `Greedy subtraction from 128 down: ${v} → ${toBin(v, 8)}.` };
}
function genB3(rng, i) {
  const t = i % 4;
  if (t === 0) { const v = rInt(rng, 16, 255); return { text: `Convert hex \`0x${toHex(v, 8)}\` to decimal.`, check: checkDec(v), answer: String(v), explain: `0x${toHex(v, 8)} = ${Math.floor(v / 16)}×16 + ${v % 16} = ${v}.` }; }
  if (t === 1) { const v = rInt(rng, 16, 255); return { text: `Write \`${v}\` in hex (8-bit).`, check: checkHex(v), answer: '0x' + toHex(v, 8), explain: `${v} = ${Math.floor(v / 16)}×16 + ${v % 16} → 0x${toHex(v, 8)}.` }; }
  if (t === 2) { const v = rInt(rng, 1, 255); return { text: `Convert binary \`${toBin(v, 8)}\` to hex.`, check: checkHex(v), answer: '0x' + toHex(v, 8), explain: `One hex digit per nibble: ${toBin(v >> 4, 4)} → ${toHex(v, 8)[0]}, ${toBin(v & 15, 4)} → ${toHex(v, 8)[1]}. No math across the boundary.` }; }
  const v = rInt(rng, 1, 255); return { text: `Convert hex \`0x${toHex(v, 8)}\` to binary (8 bits).`, check: checkBin(v), answer: toBin(v, 8), explain: `Expand each digit to 4 bits: ${toHex(v, 8)[0]} → ${toBin(v >> 4, 4)}, ${toHex(v, 8)[1]} → ${toBin(v & 15, 4)}.` };
}
function genB4(rng, i) {
  const w = i % 2 === 0 ? 4 : 8;
  const neg = rng() < 0.75;
  const v = neg ? rInt(rng, Math.pow(2, w - 1), Math.pow(2, w) - 1) : rInt(rng, 1, Math.pow(2, w - 1) - 1);
  const signed = v >= Math.pow(2, w - 1) ? v - Math.pow(2, w) : v;
  return {
    text: `\`${w}'b${toBin(v, w)}\` is a ${w}-bit two's-complement number. What's its decimal value?`,
    check: checkDec(signed), answer: String(signed),
    explain: neg ? `MSB is set, so it's negative. MSB weight is −${Math.pow(2, w - 1)}; add the remaining positive weights → ${signed}. (Shortcut: invert+1 gives ${Math.pow(2, w) - v}, so it's −${Math.pow(2, w) - v}.)` : `MSB is 0, so it's an ordinary positive number: ${signed}.`
  };
}
function genB5(rng, i) {
  const n = rInt(rng, 5, 125);
  const enc = 256 - n;
  return {
    text: `Encode \`−${n}\` as an 8-bit two's-complement value. Answer in binary or hex.`,
    check: checkBinOrHex(enc), answer: `0x${toHex(enc, 8)} (${toBin(enc, 8)})`,
    explain: `${n} = ${toBin(n, 8)}. Invert → ${toBin(255 - n, 8)}, add 1 → ${toBin(enc, 8)} = 0x${toHex(enc, 8)}.`
  };
}
function genB6(rng, i) {
  const t = i % 3;
  if (t === 0) {
    return {
      kind: 'mc', text: "What range of values can an 8-bit two's-complement number represent?",
      options: ['−128 to +127', '−127 to +128', '0 to 255', '−255 to +255'], correct: 0,
      explain: 'N bits cover −2^(n−1) … 2^(n−1)−1. The negative side gets one extra value because zero lives with the positives.'
    };
  }
  if (t === 1) {
    let a, b, sum;
    do { a = rInt(rng, -120, 120); b = rInt(rng, -120, 120); sum = a + b; } while (Math.abs(a) < 30 || Math.abs(b) < 30);
    const ovf = sum > 127 || sum < -128;
    return {
      kind: 'mc', text: `Signed 8-bit math: does \`${a} + ${b >= 0 ? b : '(' + b + ')'}\` overflow?`,
      options: ['Yes — overflow', 'No — fits fine'], correct: ovf ? 0 : 1,
      explain: `${a} + ${b} = ${sum}. The 8-bit signed range is −128…127, so it ${ovf ? 'overflows and wraps' : 'fits'}. Rule of thumb: overflow needs same-sign operands producing an opposite-sign result.`
    };
  }
  return {
    kind: 'mc', text: "Which value can NOT be represented in 4-bit two's complement?",
    options: ['+8', '−8', '+7', '−5'], correct: 0,
    explain: '4-bit range is −8 … +7. The positive side maxes out one short because 1000 is claimed by −8.'
  };
}

const GATE_FNS = {
  AND: (a, b) => a & b, OR: (a, b) => a | b, XOR: (a, b) => a ^ b,
  NAND: (a, b) => (a & b) ^ 1, NOR: (a, b) => (a | b) ^ 1, XNOR: (a, b) => (a ^ b) ^ 1,
};
function genG1(rng, i) {
  const names = Object.keys(GATE_FNS);
  const gate = names[(i + rInt(rng, 0, 5)) % 6];
  const fn = GATE_FNS[gate];
  const rows = [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => [a, b, fn(a, b)]);
  const opts = [gate];
  while (opts.length < 4) { const o = rPick(rng, names); if (!opts.includes(o)) opts.push(o); }
  const shuffled = opts.map((o) => ({ o, k: rng() })).sort((x, y) => x.k - y.k).map(x => x.o);
  return {
    kind: 'mc', text: 'This truth table belongs to which gate?',
    table: { cols: ['A', 'B', 'Y'], rows },
    options: shuffled, correct: shuffled.indexOf(gate),
    explain: { AND: 'Output 1 only on the 1,1 row → AND.', OR: 'Output 0 only on the 0,0 row → OR.', XOR: '1 exactly when inputs differ → XOR.', NAND: 'AND flipped: 0 only on the 1,1 row → NAND.', NOR: 'OR flipped: 1 only on the 0,0 row → NOR.', XNOR: '1 when inputs match → XNOR (the equality gate).' }[gate]
  };
}
function genG3(rng, i) {
  const t = i % 4;
  if (t === 0) { const a = rInt(rng, 0, 1), b = rInt(rng, 0, 1); const y = (a & b) ^ 1; return { text: `NAND gate: A=\`${a}\`, B=\`${b}\`. Output?`, check: checkDec(y), answer: String(y), explain: `AND gives ${a & b}; NAND inverts it → ${y}.` }; }
  if (t === 1) { const a = rInt(rng, 0, 1), b = rInt(rng, 0, 1); const y = (a | b) ^ 1; return { text: `NOR gate: A=\`${a}\`, B=\`${b}\`. Output?`, check: checkDec(y), answer: String(y), explain: `OR gives ${a | b}; NOR inverts it → ${y}.` }; }
  if (t === 2) return { kind: 'mc', text: 'Tie both inputs of a NAND gate to the same signal A. The gate now behaves as:', options: ['NOT', 'Buffer (Y = A)', 'Always 1', 'Always 0'], correct: 0, explain: 'NAND(A,A) = ~(A&A) = ~A. This is step one of building everything from NAND.' };
  return { kind: 'mc', text: 'Which pair of gates is universal — each able to build any circuit alone?', options: ['NAND & NOR', 'AND & OR', 'XOR & XNOR', 'Buffer & NOT'], correct: 0, explain: "Each of NAND and NOR can synthesize NOT, AND, and OR by itself. AND/OR can't make an inverter, and XOR alone can't make AND." };
}
function genG4(rng, i) {
  const t = i % 4;
  if (t === 0) return { kind: 'mc', text: 'De Morgan: `~(A & B)` equals…', options: ['~A | ~B', '~A & ~B', 'A | B', '~(A | B)'], correct: 0, explain: 'Break the bar, flip the operator: NOT-of-AND becomes OR-of-NOTs.' };
  if (t === 1) return { kind: 'mc', text: 'De Morgan: `~(A | B)` equals…', options: ['~A & ~B', '~A | ~B', 'A & B', '~(A & B)'], correct: 0, explain: 'Break the bar, flip the operator: NOT-of-OR becomes AND-of-NOTs.' };
  if (t === 2) return { kind: 'mc', text: 'Rewrite `~A & ~B` as a single gate on A and B:', options: ['NOR', 'NAND', 'XNOR', 'AND'], correct: 0, explain: 'Run De Morgan in reverse: ~A & ~B = ~(A | B) = NOR.' };
  const a = rInt(rng, 0, 1), b = rInt(rng, 0, 1);
  const y = ((a & b) ^ 1);
  return { text: `Evaluate \`~(A & B)\` with A=\`${a}\`, B=\`${b}\`.`, check: checkDec(y), answer: String(y), explain: `A&B = ${a & b}; inverted → ${y}. (Same as ~A | ~B = ${(a ^ 1) | (b ^ 1)} — De Morgan agrees, as always.)` };
}
function genG5(rng, i) {
  const pool = [
    { q: 'A & 1', a: 'A', d: ['1', '0', '~A'], why: 'ANDing with 1 passes the signal through unchanged.' },
    { q: 'A & 0', a: '0', d: ['A', '1', '~A'], why: 'ANDing with 0 kills the signal — output stuck at 0.' },
    { q: 'A | 1', a: '1', d: ['A', '0', '~A'], why: 'ORing with 1 forces the output high no matter what A is.' },
    { q: 'A & ~A', a: '0', d: ['1', 'A', '~A'], why: 'A and its complement are never both 1.' },
    { q: 'A | ~A', a: '1', d: ['0', 'A', '~A'], why: 'One of A and ~A is always 1.' },
    { q: 'A ^ A', a: '0', d: ['1', 'A', '~A'], why: 'XOR is 1 only when inputs differ — A never differs from itself.' },
    { q: 'A ^ 1', a: '~A', d: ['A', '1', '0'], why: 'XOR with 1 flips the bit: a controllable inverter.' },
    { q: 'A | (A & B)', a: 'A', d: ['B', 'A & B', 'A | B'], why: 'Absorption: if A=1 the output is 1; if A=0 both terms die. B never matters.' },
    { q: 'A & (A | B)', a: 'A', d: ['B', 'A | B', '1'], why: 'Absorption again: the output simply tracks A.' },
    { q: 'A ^ 0', a: 'A', d: ['0', '1', '~A'], why: 'XOR with 0 changes nothing — the identity input.' },
  ];
  const item = pool[(i * 3 + rInt(rng, 0, pool.length - 1)) % pool.length];
  const opts = [item.a, ...item.d];
  const shuffled = opts.map(o => ({ o, k: rng() })).sort((x, y) => x.k - y.k).map(x => x.o);
  return { kind: 'mc', text: `Simplify: \`${item.q}\``, options: shuffled, correct: shuffled.indexOf(item.a), explain: item.why };
}
function genG6(rng, i) {
  const t = i % 4;
  if (t === 0) return { kind: 'mc', text: 'Bubble push: an OR gate with both inputs inverted (`~A | ~B`) is the same single gate as…', options: ['NAND', 'NOR', 'AND', 'XNOR'], correct: 0, explain: "Push the input bubbles through: OR becomes AND with one output bubble → NAND. It's De Morgan drawn as a picture." };
  if (t === 1) return { kind: 'mc', text: 'Bubble push: an AND gate with both inputs inverted (`~A & ~B`) equals…', options: ['NOR', 'NAND', 'OR', 'XOR'], correct: 0, explain: 'Inverted-input AND = output-inverted OR = NOR.' };
  if (t === 2) return { kind: 'mc', text: 'A NAND gate followed by a NOT gate behaves as…', options: ['AND', 'OR', 'NOR', 'NOT'], correct: 0, explain: 'Two inversions cancel: ~(~(A&B)) = A&B.' };
  const a = rInt(rng, 0, 1), b = rInt(rng, 0, 1);
  const y = (a ^ 1) | (b ^ 1);
  return { text: `Evaluate \`~A | ~B\` with A=\`${a}\`, B=\`${b}\`.`, check: checkDec(y), answer: String(y), explain: `~A=${a ^ 1}, ~B=${b ^ 1} → OR = ${y}. Matches NAND(${a},${b}) = ${(a & b) ^ 1}.` };
}

// FSM tracer: "detect 10" Moore machine
const F1_TABLE = {
  cols: ['State', 'meaning', 'x=0 →', 'x=1 →', 'out'],
  rows: [
    ['S0', 'start', 'S0', 'S1', '0'],
    ['S1', 'saw "1"', 'S2', 'S1', '0'],
    ['S2', 'saw "10"', 'S0', 'S1', '1'],
  ]
};
function f1Step(s, x) { if (s === 0) return x ? 1 : 0; if (s === 1) return x ? 1 : 2; return x ? 1 : 0; }
function genF1(rng, i) {
  const len = rInt(rng, 4, 6);
  const bits = Array.from({ length: len }, () => rInt(rng, 0, 1));
  let s = 0; let outs = 0;
  const path = ['S0'];
  for (const x of bits) { s = f1Step(s, x); path.push('S' + s); if (s === 2) outs++; }
  if (i % 2 === 0) {
    return {
      kind: 'mc', text: `Start in S0 (reset). Feed the input sequence x = \`${bits.join(', ')}\` (one bit per clock). Which state is the machine in afterwards?`,
      table: F1_TABLE, options: ['S0', 'S1', 'S2'], correct: s,
      explain: `Trace: ${path.join(' → ')}. Final state ${path[path.length - 1]}.`
    };
  }
  return {
    text: `Start in S0. Feed x = \`${bits.join(', ')}\`. For how many cycles is the output 1? (out=1 only in S2)`,
    table: F1_TABLE, check: checkDec(outs), answer: String(outs),
    explain: `Trace: ${path.join(' → ')}. S2 appears ${outs} time${outs === 1 ? '' : 's'} — this machine fires every time it sees "10".`
  };
}

function _gpick(pool, i) { return pool[((i % pool.length) + pool.length) % pool.length]; }
function genG7(rng, i) {
  const pool = [
    { kind: 'mc', text: "Minimize: Y = A·B + A·B'   (B' = NOT B)", options: ['Y = A', 'Y = B', 'Y = A·B', 'Y = A + B'], correct: 0, explain: "B + B' = 1, so A·(B + B') = A." },
    { kind: 'mc', text: "Minimize: Y = A + A·B", options: ['Y = A', 'Y = B', 'Y = A·B', 'Y = A + B'], correct: 0, explain: "Absorption: A + A·B = A." },
    { kind: 'mc', text: "Minimize: Y = A·B + A'·B   (A' = NOT A)", options: ['Y = B', 'Y = A', 'Y = A·B', 'Y = A + B'], correct: 0, explain: "(A + A')·B = 1·B = B." },
    { kind: 'mc', text: "Adjacent 1-cells in a K-map combine to eliminate the variable that —", options: ['changes between them', 'stays the same', 'both variables', 'neither variable'], correct: 0, explain: "A group of adjacent minterms drops the variable whose value differs across the group." },
    { kind: 'mc', text: "Minimize: Y = A·B·C + A·B·C'", options: ['Y = A·B', 'Y = A·C', 'Y = B·C', 'Y = A·B·C'], correct: 0, explain: "C + C' = 1, leaving A·B." },
    { kind: 'mc', text: "A don't-care (X) in a K-map may be —", options: ['set to 0 or 1, whichever simplifies more', 'always treated as 1', 'always treated as 0', 'skipped entirely'], correct: 0, explain: "Assign each don't-care the value that yields the largest groups and simplest logic." },
  ];
  return _gpick(pool, i);
}
function genS8(rng, i) {
  const pool = [
    { kind: 'mc', text: "Setup time is the window BEFORE the clock edge during which the data input must be —", options: ['stable', 'changing', 'high', 'low'], correct: 0, explain: "Data must hold stable for the setup time before the edge so the flip-flop samples it reliably." },
    { kind: 'mc', text: "Hold time is the window AFTER the clock edge during which the data must remain —", options: ['stable', 'floating', 'inverted', 'rising'], correct: 0, explain: "Data must stay stable for the hold time after the edge to be latched correctly." },
    { kind: 'mc', text: "Violating setup or hold time can drive a flip-flop into —", options: ['metastability', 'a reset', 'tri-state', 'permanent oscillation'], correct: 0, explain: "A setup/hold violation can leave the output metastable — hung between 0 and 1 — for an unbounded time." },
    { kind: 'mc', text: "The maximum clock frequency of a pipeline is set by —", options: ['the longest combinational path between registers', 'the shortest path', 'the number of registers', 'the reset duration'], correct: 0, explain: "The critical (longest) register-to-register path bounds the minimum clock period, hence the max frequency." },
    { kind: 'mc', text: "Clock period must be at least —   (Tcq = clk-to-Q, Tlogic = logic delay, Tsu = setup)", options: ['Tcq + Tlogic + Tsu', 'Tcq + Tsu', 'Tlogic only', 'Tcq + Thold'], correct: 0, explain: "T_clk >= Tcq + Tlogic + Tsu so data launches, propagates, and settles before the next edge." },
    { kind: 'mc', text: "Inserting a pipeline register into a long combinational path generally —", options: ['raises max frequency, adds latency', 'lowers max frequency', 'removes latency', 'has no effect'], correct: 0, explain: "Pipelining shortens the critical path (higher fmax) at the cost of extra cycles of latency." },
  ];
  return _gpick(pool, i);
}
function genF4(rng, i) {
  const pool = [
    { kind: 'mc', text: "A finite state machine has 5 states. With binary encoding, how many flip-flops are needed?", options: ['3', '2', '5', '4'], correct: 0, explain: "ceil(log2(5)) = 3 flip-flops (2^3 = 8 >= 5)." },
    { kind: 'mc', text: "One-hot encoding of a machine with 6 states uses how many flip-flops?", options: ['6', '3', '1', '2'], correct: 0, explain: "One-hot uses one flip-flop per state — exactly one is set at a time." },
    { kind: 'mc', text: "The main advantage of one-hot over binary encoding is —", options: ['simpler, faster next-state logic', 'fewer flip-flops', 'always lower power', 'always smaller area'], correct: 0, explain: "One-hot trades more flip-flops for simpler next-state/output logic, often improving speed." },
    { kind: 'mc', text: "A Moore machine's output depends on —", options: ['the current state only', 'the state and the inputs', 'the inputs only', 'the next state'], correct: 0, explain: "Moore outputs depend on state alone; Mealy outputs depend on state AND current inputs." },
    { kind: 'mc', text: "A Mealy machine differs from a Moore machine because its output also depends on —", options: ['the current inputs', 'the clock', 'the reset', 'the previous output'], correct: 0, explain: "Mealy outputs are a function of state and current inputs, so they can change within a cycle." },
    { kind: 'mc', text: "Binary-encoding a machine with 9 states needs how many flip-flops?", options: ['4', '3', '9', '5'], correct: 0, explain: "ceil(log2(9)) = 4 (2^4 = 16 >= 9)." },
  ];
  return _gpick(pool, i);
}

const GAUNTLETS = [
  { id: 'b1', world: 1, title: 'Binary Bedrock', xp: 30, gen: genB1, intro: 'Five conversions between binary and decimal, 4 bits at a time. The pickaxe work every engineer starts with.' },
  { id: 'b2', world: 1, title: 'Heavy Bits', xp: 30, gen: genB2, intro: 'Same game, full bytes. 8-bit conversions — learn to see 128s and 64s at a glance.' },
  { id: 'b3', world: 1, title: 'Hex Runes', xp: 30, gen: genB3, intro: 'Hex is binary with the boring parts compressed. One digit per nibble — never do math across the boundary.' },
  { id: 'b4', world: 1, title: 'The Sign Bit', xp: 35, gen: genB4, intro: "Two's complement reading. The MSB is negative; everything else is normal. Decode the values." },
  { id: 'b5', world: 1, title: 'Negation Ritual', xp: 35, gen: genB5, intro: 'Invert every bit, add one. Encode negative numbers the way the silicon does.' },
  { id: 'b6', world: 1, title: 'Overflow Omen', xp: 35, gen: genB6, intro: 'Ranges and the wraparound that ate a rocket. Know exactly where the cliff edge is.' },
  { id: 'g1', world: 2, title: 'Meet the Gates', xp: 30, gen: genG1, intro: "A truth table is a gate's fingerprint. Identify the suspect from its prints." },
  { id: 'g3', world: 2, title: 'Universal Workshop', xp: 30, gen: genG3, intro: 'NAND and NOR can build anything — including each other. Work the inverted gates.' },
  { id: 'g4', world: 2, title: "De Morgan's Mirror", xp: 30, gen: genG4, intro: 'Break the bar, flip the operator. The most-used identity in all of digital design.' },
  { id: 'g5', world: 2, title: 'Boolean Cleanup', xp: 30, gen: genG5, intro: 'Fewer gates, same truth table. Simplify like a synthesis tool.' },
  { id: 'g6', world: 2, title: 'Bubble Pusher', xp: 35, gen: genG6, intro: 'Slide inversion bubbles through gates and watch AND and OR trade places.' },
  { id: 'f1', world: 6, title: 'State Tracer', xp: 35, gen: genF1, intro: 'Before you build state machines, learn to BE one. Trace this "detect 10" Moore machine by hand, cycle by cycle.' },
  { id: 'g7', world: 2, title: 'Karnaugh Forge', xp: 35, gen: genG7, intro: 'Fewer gates, same truth. Spot the minimal form the way a Karnaugh map (and a synthesis tool) would.' },
  { id: 's8', world: 5, title: 'Timing Trial', xp: 40, gen: genS8, intro: 'Registers only work if the data is there when the edge arrives. Setup, hold, and the clock period that ties them together.' },
  { id: 'f4', world: 6, title: 'Encoding Vault', xp: 40, gen: genF4, intro: 'Binary or one-hot? Count the flip-flops and weigh the trade. Moore versus Mealy while you are in here.' },
];

// ---------- truth-table challenge ----------
const TRUTH_CHALLENGES = [
  {
    id: 'g2', world: 2, title: 'Truth Forge', xp: 35,
    intro: "Fill in the complete truth table for the expression. Click the Y cells to toggle. Every row must be right — the table is the circuit's entire identity.",
    pool: [
      { label: 'Y = (A ^ B) & C', vars: ['A', 'B', 'C'], fn: (A, B, C) => (A ^ B) & C },
      { label: 'Y = (A | B) & ~C', vars: ['A', 'B', 'C'], fn: (A, B, C) => (A | B) & (C ? 0 : 1) },
      { label: 'Y = ~(A & B) | C', vars: ['A', 'B', 'C'], fn: (A, B, C) => ((A & B) ^ 1) | C },
      { label: 'Y = (A & B) ^ C', vars: ['A', 'B', 'C'], fn: (A, B, C) => (A & B) ^ C },
      { label: 'Y = A & (B | C)', vars: ['A', 'B', 'C'], fn: (A, B, C) => A & (B | C) },
    ]
  }
];

// ---------- code challenge helpers ----------
function combVecs(inputs, ref, opts = {}) {
  const totalBits = inputs.reduce((s, p) => s + p.w, 0);
  const vectors = [];
  const addVec = (vals) => {
    const inObj = {};
    inputs.forEach((p, i) => { inObj[p.n] = vals[i]; });
    vectors.push({ in: inObj, out: ref(inObj) });
  };
  if (totalBits <= 8 && !opts.sample) {
    for (let x = 0; x < Math.pow(2, totalBits); x++) {
      let rem = x;
      const vals = inputs.map(p => { const v = rem % Math.pow(2, p.w); rem = Math.floor(rem / Math.pow(2, p.w)); return v; });
      addVec(vals);
    }
    return vectors;
  }
  const rng = mulberry32(opts.seed || 1337);
  const edgeOf = (w) => [0, 1, Math.pow(2, w) - 1, Math.pow(2, w - 1) % Math.pow(2, w), 0b10101010 % Math.pow(2, w), 0b01010101 % Math.pow(2, w)];
  const seen = new Set();
  const tryAdd = (vals) => { const k = vals.join(','); if (seen.has(k)) return; seen.add(k); addVec(vals); };
  for (let e = 0; e < 4; e++) tryAdd(inputs.map(p => edgeOf(p.w)[e % 6]));
  let guard = 0;
  while (vectors.length < (opts.n || 16) && guard++ < 500) tryAdd(inputs.map(p => rInt(rng, 0, Math.pow(2, p.w) - 1)));
  return vectors;
}

const m8w = (x) => ((x % 256) + 256) % 256;

// ---------- code challenges (Worlds 3-4) ----------
const CODE_CHALLENGES_A = [
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
// ---------- code challenges (Worlds 5-7) ----------
const CODE_CHALLENGES_B = [
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

const CODE_CHALLENGES = CODE_CHALLENGES_A.concat(CODE_CHALLENGES_B);

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

// ---------- Binary Blitz ----------
function blitzGen(score, rng) {
  let pool;
  if (score < 6) pool = ['b2d4', 'd2b4'];
  else if (score < 13) pool = ['b2d4', 'd2b4', 'h2d', 'd2h', 'b2h', 'h2b'];
  else if (score < 21) pool = ['b2d8', 'd2b8', 'h2d', 'd2h', 'b2h', 'h2b'];
  else pool = ['b2d8', 'd2b8', 'h2d', 'd2h', 'b2h', 'h2b', 'twos', 'neg'];
  const t = rPick(rng, pool);
  switch (t) {
    case 'b2d4': { const v = rInt(rng, 1, 15); return { text: toBin(v, 4), sub: 'binary → decimal', check: checkDec(v), answer: String(v) }; }
    case 'd2b4': { const v = rInt(rng, 1, 15); return { text: String(v), sub: 'decimal → binary', check: checkBin(v), answer: toBin(v, 4) }; }
    case 'b2d8': { const v = rInt(rng, 16, 254); return { text: toBin(v, 8), sub: 'binary → decimal', check: checkDec(v), answer: String(v) }; }
    case 'd2b8': { const v = rInt(rng, 16, 254); return { text: String(v), sub: 'decimal → binary (8-bit)', check: checkBin(v), answer: toBin(v, 8) }; }
    case 'h2d': { const v = rInt(rng, 16, 255); return { text: '0x' + toHex(v, 8), sub: 'hex → decimal', check: checkDec(v), answer: String(v) }; }
    case 'd2h': { const v = rInt(rng, 16, 255); return { text: String(v), sub: 'decimal → hex', check: checkHex(v), answer: '0x' + toHex(v, 8) }; }
    case 'b2h': { const v = rInt(rng, 1, 255); return { text: toBin(v, 8), sub: 'binary → hex', check: checkHex(v), answer: '0x' + toHex(v, 8) }; }
    case 'h2b': { const v = rInt(rng, 1, 255); return { text: '0x' + toHex(v, 8), sub: 'hex → binary', check: checkBin(v), answer: toBin(v, 8) }; }
    case 'twos': { const v = rInt(rng, 128, 255); return { text: toBin(v, 8), sub: "8-bit two's comp → signed decimal", check: checkDec(v - 256), answer: String(v - 256) }; }
    default: { const n = rInt(rng, 5, 125); return { text: '−' + n, sub: "→ 8-bit two's comp (bin or hex)", check: checkBinOrHex(256 - n), answer: '0x' + toHex(256 - n, 8) }; }
  }
}

// ---------- achievements & ranks ----------
const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', desc: 'Complete your first challenge', xp: 10 },
  { id: 'it_compiles', name: 'It Compiles', desc: 'Pass your first Verilog code challenge', xp: 25 },
  { id: 'w1_done', name: 'Bit Lord', desc: 'Clear The Bit Mines', xp: 30 },
  { id: 'w2_done', name: 'Gatekeeper', desc: 'Clear Gate Valley', xp: 30 },
  { id: 'w3_done', name: 'Forged', desc: 'Clear Module Foundry', xp: 30 },
  { id: 'w4_done', name: 'Canyon Crosser', desc: 'Clear Combinational Canyon', xp: 30 },
  { id: 'w5_done', name: 'Timekeeper', desc: 'Clear The Clock Tower', xp: 30 },
  { id: 'w6_done', name: 'State of Mind', desc: 'Clear FSM Fortress', xp: 30 },
  { id: 'tapeout', name: 'TAPEOUT', desc: 'Ship CHIP-1', xp: 150 },
  { id: 'blitz_15', name: 'Nibble Ninja', desc: 'Score 15+ in Binary Blitz', xp: 25 },
  { id: 'blitz_30', name: 'Byte Lord', desc: 'Score 30+ in Binary Blitz', xp: 50 },
  { id: 'combo_10', name: 'Overclocked', desc: 'Hit a 10× combo in Binary Blitz', xp: 25 },
  { id: 'bug_5', name: 'Exterminator', desc: 'Squash 5 bugs in Bug Bounty', xp: 20 },
  { id: 'bug_all', name: 'Lint Champion', desc: 'Squash all 12 bugs', xp: 40 },
  { id: 'stars_10', name: 'Perfectionist', desc: 'Earn 3★ on 10 challenges', xp: 40 },
  { id: 'streak_3', name: 'Back Again', desc: '3-day streak', xp: 15 },
  { id: 'streak_7', name: 'Week of Silicon', desc: '7-day streak', xp: 40 },
  { id: 'scholar', name: 'Scholar', desc: 'Read every lesson', xp: 30 },
];

const RANKS = [
  ['Intern', 0],
  ['Junior RTL Engineer', 100],
  ['RTL Engineer I', 250],
  ['RTL Engineer II', 500],
  ['Senior RTL Engineer', 850],
  ['Staff Engineer', 1300],
  ['Principal Engineer', 1850],
  ['Distinguished Engineer', 2500],
  ['Chief Architect', 3300],
];

// ============================================================
// NG+ REMIX — architect-mode challenge variants (altered specs)
// ============================================================

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

// ============================================================
// TRAINING GENERATORS — drills, spaced review, forge support
// ============================================================

// ---------- difficulty modes ----------
const MODES = [
  { id: 'apprentice', label: 'Apprentice', mult: 1, maxHints: 99, solAfter: 3, blurb: 'Full hints, starter code, standard benches.' },
  { id: 'engineer', label: 'Engineer', mult: 1.5, maxHints: 1, solAfter: 5, blurb: 'One hint, extended benches, 1.5× XP.' },
  { id: 'architect', label: 'Architect', mult: 2, maxHints: 0, solAfter: Infinity, blurb: 'No hints, no starter code, timed bosses, 2× XP.' },
];
const modeOf = (id) => MODES.find(m => m.id === id) || MODES[0];
const BOSS_TIME = { c7: 240, s7: 300, f3: 360, chip1: 480 };

// ---------- topic map (for stats heatmap) ----------
const TOPIC_LIST = [
  { id: 'numbers', label: 'Number Systems' },
  { id: 'gates', label: 'Gates' },
  { id: 'boolean', label: 'Boolean Algebra' },
  { id: 'wiring', label: 'Buses & Wiring' },
  { id: 'mux', label: 'Muxes' },
  { id: 'arith', label: 'Arithmetic' },
  { id: 'decode', label: 'Decode & Compare' },
  { id: 'seq', label: 'Sequential' },
  { id: 'fsm', label: 'FSMs & Chips' },
];
const TOPIC_OF = {
  b1: 'numbers', b2: 'numbers', b3: 'numbers', b4: 'numbers', b5: 'numbers', b6: 'numbers',
  g1: 'gates', g3: 'gates', g2: 'boolean', g4: 'boolean', g5: 'boolean', g6: 'boolean', g7: 'boolean',
  m1: 'gates', m2: 'gates', m3: 'arith', m4: 'boolean', m5: 'wiring', m6: 'wiring', m7: 'wiring',
  c1: 'mux', c2: 'mux', c3: 'arith', c4: 'arith', c5: 'decode', c6: 'arith', c7: 'decode', c8: 'decode', c9: 'arith', c10: 'decode', c11: 'arith',
  s1: 'seq', s2: 'seq', s3: 'seq', s4: 'seq', s5: 'seq', s6: 'seq', s7: 'seq', s8: 'seq',
  f1: 'fsm', f2: 'fsm', f3: 'fsm', f4: 'fsm', chip1: 'fsm',
  tg_soup: 'boolean', tg_mux: 'mux', tg_slice: 'wiring', tg_count: 'seq', tg_cmp: 'decode', tg_range: 'decode', tg_shift: 'seq',
};

// ---------- test hardening (Engineer / Architect benches) ----------
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hardenTest(ch) {
  const t = ch.test;
  if (t.type === 'comb') return t; // comb benches are already exhaustive
  const ins = ch.iface.ports.filter(p => p.d === 'in' && p.n !== 'clk');
  const rng = mulberry32(hashStr(ch.id + ':hard'));
  const extra = [];
  for (let i = 0; i < 14; i++) {
    const f = {};
    ins.forEach(p => {
      if (p.n === 'rst') f.rst = rng() < 0.12 ? 1 : 0;
      else f[p.n] = rInt(rng, 0, Math.pow(2, p.w) - 1);
    });
    extra.push(f);
  }
  return { ...t, frames: t.frames.concat(extra) };
}
CODE_CHALLENGES.forEach(ch => { ch.testHard = hardenTest(ch); });
Object.keys(REMIX).forEach(id => { const r = REMIX[id]; r.id = id + '+'; r.world = CODE_CHALLENGES.find(c => c.id === id).world; r.testHard = hardenTest(r); r.hints = r.hints || []; r.starter = r.starter || ''; });

function genGateSoup(rng) {
  const ops = [['&', (x, y) => x & y, 'AND'], ['|', (x, y) => x | y, 'OR'], ['^', (x, y) => x ^ y, 'XOR']];
  const o1 = rPick(rng, ops), o2 = rPick(rng, ops);
  const invC = rng() < 0.5, invAll = rng() < 0.35;
  const inner = `(a ${o1[0]} b) ${o2[0]} ${invC ? '~' : ''}c`;
  const expr = invAll ? `~(${inner})` : inner;
  const fn = (a, b, c) => {
    const cc = invC ? c ^ 1 : c;
    let v = o2[1](o1[1](a, b), cc);
    return invAll ? v ^ 1 : v;
  };
  return {
    gid: 'tg_soup', title: 'Gate Soup', xp: 15,
    brief: `Implement exactly this expression:\n\n\`y = ${expr}\`\n\nOne assign. The bench checks all 8 input rows — precedence mistakes have nowhere to hide.`,
    iface: { name: 'soup', ports: [{ n: 'a', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 1 }, { n: 'c', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 1 }] },
    solution: `module soup(input a, input b, input c, output y);\n  assign y = ${expr};\nendmodule\n`,
    test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 1 }, { n: 'b', w: 1 }, { n: 'c', w: 1 }], (i) => ({ y: fn(i.a, i.b, i.c) })) }
  };
}
function genMuxMania(rng) {
  const N = rPick(rng, [2, 4, 8]);
  const sw = N === 2 ? 1 : N === 4 ? 2 : 3;
  const dports = Array.from({ length: N }, (_, i) => ({ n: 'd' + i, d: 'in', w: 1 }));
  const iface = { name: 'muxn', ports: [...dports, { n: 'sel', d: 'in', w: sw }, { n: 'y', d: 'out', w: 1 }] };
  let sol;
  if (N === 2) sol = 'assign y = sel ? d1 : d0;';
  else if (N === 4) sol = 'assign y = sel[1] ? (sel[0] ? d3 : d2) : (sel[0] ? d1 : d0);';
  else sol = 'assign y = sel[2] ? (sel[1] ? (sel[0] ? d7 : d6) : (sel[0] ? d5 : d4))\n           : (sel[1] ? (sel[0] ? d3 : d2) : (sel[0] ? d1 : d0));';
  const ref = (i) => ({ y: i['d' + i.sel] });
  const inputs = iface.ports.filter(p => p.d === 'in').map(p => ({ n: p.n, w: p.w }));
  return {
    gid: 'tg_mux', title: `Mux Mania · ${N}:1`, xp: 15,
    brief: `Build a ${N}:1 multiplexer: \`sel = ${sw}'d0\` picks \`d0\`, the highest code picks \`d${N - 1}\`. Nested ternaries${N >= 4 ? ' or a case with a default' : ''} — your call.`,
    iface,
    solution: `module muxn(${dports.map(p => 'input ' + p.n).join(', ')}, input [${sw - 1}:0] sel, output y);\n  ${sol}\nendmodule\n`,
    test: { type: 'comb', vectors: combVecs(inputs, ref, N === 8 ? { sample: true, n: 36, seed: rInt(rng, 1, 99999) } : {}) }
  };
}
function genSliceDice(rng) {
  if (rng() < 0.5) {
    const k = rInt(rng, 1, 7);
    return {
      gid: 'tg_slice', title: `Slice & Dice · rot ${k}`, xp: 15,
      brief: `Rotate the byte LEFT by ${k}: bits slide up ${k} positions and the top ${k} bits wrap around to the bottom. Pure concatenation — \`{in_byte[${7 - k}:0], in_byte[7:${8 - k}]}\` is the shape.`,
      iface: { name: 'rotk', ports: [{ n: 'in_byte', d: 'in', w: 8 }, { n: 'out_byte', d: 'out', w: 8 }] },
      solution: `module rotk(input [7:0] in_byte, output [7:0] out_byte);\n  assign out_byte = {in_byte[${7 - k}:0], in_byte[7:${8 - k}]};\nendmodule\n`,
      test: { type: 'comb', vectors: combVecs([{ n: 'in_byte', w: 8 }], (i) => ({ out_byte: ((i.in_byte << k) & 255) | (i.in_byte >> (8 - k)) })) }
    };
  }
  return {
    gid: 'tg_slice', title: 'Slice & Dice · swap-invert', xp: 15,
    brief: "Swap the nibbles, then invert every bit. One assign: a concatenation wrapped in a `~`.",
    iface: { name: 'swinv', ports: [{ n: 'in_byte', d: 'in', w: 8 }, { n: 'out_byte', d: 'out', w: 8 }] },
    solution: "module swinv(input [7:0] in_byte, output [7:0] out_byte);\n  assign out_byte = ~{in_byte[3:0], in_byte[7:4]};\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'in_byte', w: 8 }], (i) => ({ out_byte: 255 & ~(((i.in_byte & 15) << 4) | (i.in_byte >> 4)) })) }
  };
}
function genCounterFoundry(rng) {
  const M = rInt(rng, 5, 14);
  const hasEn = rng() < 0.5;
  const ports = [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }];
  if (hasEn) ports.push({ n: 'en', d: 'in', w: 1 });
  ports.push({ n: 'q', d: 'out', w: 4 });
  const frames = [{ rst: 1, ...(hasEn ? { en: 0 } : {}) }];
  for (let i = 0; i < Math.floor(M * 2.5); i++) frames.push({ rst: 0, ...(hasEn ? { en: rng() < 0.8 ? 1 : 0 } : {}) });
  frames.push({ rst: 1, ...(hasEn ? { en: 1 } : {}) });
  for (let i = 0; i < 4; i++) frames.push({ rst: 0, ...(hasEn ? { en: 1 } : {}) });
  return {
    gid: 'tg_count', title: `Counter Foundry · mod-${M}`, xp: 15,
    brief: `A mod-${M} counter: counts 0, 1, … ${M - 1}, then back to 0 — the 4-bit wrap won't save you here, you must detect \`${M - 1}\` yourself.${hasEn ? ' Counts only while `en` is high; holds otherwise.' : ''} \`rst\` clears to 0.`,
    iface: { name: 'modcnt', ports },
    solution: `module modcnt(input clk, input rst, ${hasEn ? 'input en, ' : ''}output reg [3:0] q);\n  always @(posedge clk) begin\n    if (rst) q <= 4'd0;\n    else ${hasEn ? 'if (en) ' : ''}q <= (q == 4'd${M - 1}) ? 4'd0 : q + 1;\n  end\nendmodule\n`,
    test: {
      type: 'seq', watch: ['q'], frames,
      makeRef: () => ({ q: 0, step(f) { if (f.rst) this.q = 0; else if (!hasEn || f.en) this.q = (this.q === M - 1) ? 0 : this.q + 1; return { q: this.q }; } })
    }
  };
}
function genCompareLab(rng) {
  return {
    gid: 'tg_cmp', title: 'Compare Lab', xp: 15,
    brief: "A 4-bit comparator with three flags: `lt` when `a < b`, `eq` when equal, `gt` when `a > b` (unsigned). Exactly one fires for every input pair — the bench checks all 256.",
    iface: { name: 'cmp4', ports: [{ n: 'a', d: 'in', w: 4 }, { n: 'b', d: 'in', w: 4 }, { n: 'lt', d: 'out', w: 1 }, { n: 'eq', d: 'out', w: 1 }, { n: 'gt', d: 'out', w: 1 }] },
    solution: "module cmp4(input [3:0] a, input [3:0] b, output lt, output eq, output gt);\n  assign lt = a < b;\n  assign eq = a == b;\n  assign gt = a > b;\nendmodule\n",
    test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 4 }, { n: 'b', w: 4 }], (i) => ({ lt: i.a < i.b ? 1 : 0, eq: i.a === i.b ? 1 : 0, gt: i.a > i.b ? 1 : 0 })) }
  };
}
function genRangeDetect(rng) {
  const lo = rInt(rng, 1, 9);
  const hi = rInt(rng, lo + 2, 14);
  return {
    gid: 'tg_range', title: `Range Detect · [${lo}, ${hi}]`, xp: 15,
    brief: `\`y\` fires when the unsigned input is inside the window: \`${lo} ≤ a ≤ ${hi}\`. Two comparisons and one AND — address decoders are exactly this circuit with bigger numbers.`,
    iface: { name: 'inrange', ports: [{ n: 'a', d: 'in', w: 4 }, { n: 'y', d: 'out', w: 1 }] },
    solution: `module inrange(input [3:0] a, output y);\n  assign y = (a >= 4'd${lo}) & (a <= 4'd${hi});\nendmodule\n`,
    test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 4 }], (i) => ({ y: (i.a >= lo && i.a <= hi) ? 1 : 0 })) }
  };
}
function genShiftShop(rng) {
  const left = rng() < 0.5;
  const frames = [{ rst: 1, sin: 0 }];
  for (let i = 0; i < 11; i++) frames.push({ rst: rng() < 0.1 ? 1 : 0, sin: rInt(rng, 0, 1) });
  return {
    gid: 'tg_shift', title: `Shift Shop · ${left ? 'left' : 'right'}`, xp: 15,
    brief: left
      ? "4-bit shift register, LEFT: every clock the word slides up and `sin` enters at bit 0. `rst` clears."
      : "4-bit shift register, RIGHT: every clock the word slides down and `sin` enters at bit 3 (the top). `rst` clears.",
    iface: { name: 'shgen', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'rst', d: 'in', w: 1 }, { n: 'sin', d: 'in', w: 1 }, { n: 'q', d: 'out', w: 4 }] },
    solution: left
      ? "module shgen(input clk, input rst, input sin, output reg [3:0] q);\n  always @(posedge clk) begin\n    if (rst) q <= 4'd0;\n    else     q <= {q[2:0], sin};\n  end\nendmodule\n"
      : "module shgen(input clk, input rst, input sin, output reg [3:0] q);\n  always @(posedge clk) begin\n    if (rst) q <= 4'd0;\n    else     q <= {sin, q[3:1]};\n  end\nendmodule\n",
    test: {
      type: 'seq', watch: ['q'], frames,
      makeRef: () => ({ q: 0, step(f) { if (f.rst) this.q = 0; else this.q = left ? ((this.q * 2 + f.sin) % 16) : ((f.sin << 3) | (this.q >> 1)); return { q: this.q }; } })
    }
  };
}

const TRAINING_GENS = [
  { gid: 'tg_soup', name: 'Gate Soup', gen: genGateSoup, blurb: 'Random boolean expressions. Precedence boot camp.' },
  { gid: 'tg_mux', name: 'Mux Mania', gen: genMuxMania, blurb: '2:1, 4:1, 8:1 — the selection trees never end.' },
  { gid: 'tg_slice', name: 'Slice & Dice', gen: genSliceDice, blurb: 'Rotates, swaps, inversions. Concatenation cardio.' },
  { gid: 'tg_count', name: 'Counter Foundry', gen: genCounterFoundry, blurb: 'Mod-M counters with random moduli and enables.' },
  { gid: 'tg_cmp', name: 'Compare Lab', gen: genCompareLab, blurb: 'Comparator flags across all 256 input pairs.' },
  { gid: 'tg_range', name: 'Range Detect', gen: genRangeDetect, blurb: 'Window detectors — baby address decoders.' },
  { gid: 'tg_shift', name: 'Shift Shop', gen: genShiftShop, blurb: 'Serial data, both directions, random benches.' },
];

// ---------- daily challenge ----------
function dailyFor(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const days = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  const rng = mulberry32((days * 2654435761) >>> 0);
  const g = TRAINING_GENS[days % TRAINING_GENS.length];
  const ch = g.gen(rng);
  ch.title = 'Daily Bench · ' + ch.title;
  ch.xp = 30;
  ch.daily = dateStr;
  return ch;
}

// ---------- new achievements ----------
ACHIEVEMENTS.push(
  { id: 'second_silicon', name: 'Second Silicon', desc: 'Ship CHIP-2 in New Game+', xp: 100 },
  { id: 'iron_architect', name: 'Iron Architect', desc: 'Clear 10 challenges in Architect mode', xp: 60 },
  { id: 'daily_7', name: 'Range Regular', desc: 'Complete 7 daily benches', xp: 30 },
  { id: 'forge_25', name: 'Foundry Shift', desc: '25 training-ground clears', xp: 30 },
);

export {
  mulberry32, combVecs, hashStr, hardenTest, WORLDS, LESSONS, LESSON_DEPTH,
  GAUNTLETS, TRUTH_CHALLENGES, CODE_CHALLENGES, REMIX, BUG_HUNTS,
  ACHIEVEMENTS, RANKS, MODES, modeOf, BOSS_TIME, TOPIC_LIST, TOPIC_OF,
  TRAINING_GENS, dailyFor, blitzGen,
};
