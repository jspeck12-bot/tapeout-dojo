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
        "A half adder adds two bits: `sum = a ^ b`, `carry = a & b`. XOR is the sum, AND is the carry — burn that in.\n\nA full adder takes a carry-in too: `sum = a ^ b ^ cin`, `cout = a&b | cin&(a^b)`. Chain full adders and you get a ripple-carry adder: the carry walks every stage, so a 32-bit add is slower than a 4-bit one. Carry-lookahead computes that carry in parallel and shortens the critical path — open the timing tab after a compile to see the difference in delay units.\n\nIn Verilog you can skip the manual chain — `a + b` synthesizes the whole thing (modeled here as ripple). The trick is catching the carry: the sum of two 4-bit numbers needs 5 bits.",
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

export { LESSONS, LESSON_DEPTH };
