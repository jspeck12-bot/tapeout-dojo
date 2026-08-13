import { rInt, rPick, toBin, toHex, checkDec, checkBin, checkHex, checkBinOrHex } from './util.js';

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

export {
  genB1, genB2, genB3, genB4, genB5, genB6,
  genG1, genG3, genG4, genG5, genG6, genG7,
  genF1, genF4, genS8,
  GATE_FNS, F1_TABLE, f1Step,
};
