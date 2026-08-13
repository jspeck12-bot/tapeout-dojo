import { mulberry32, rInt, rPick, combVecs } from './util.js';

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

// ---------- spaced recall (SM-2-lite, keyed by topic id) ----------
function reviewInit() {
  return { seen: 0, lapses: 0, streak: 0, ease: 2.3, interval: 0, dueDay: 0, lastDay: 0, lastQ: 0 };
}
function _clampEase(e) { return Math.max(1.3, Math.min(2.8, e)); }
function reviewUpdate(rec, quality, today) {
  const r = rec ? Object.assign(reviewInit(), rec) : reviewInit();
  const q = Math.max(0, Math.min(1, quality));
  r.seen += 1; r.lastDay = today; r.lastQ = q;
  if (q >= 0.5) {
    r.streak += 1;
    r.ease = _clampEase(r.ease + (q - 0.6) * 0.4);
    r.interval = r.streak <= 1 ? 1 : (r.streak === 2 ? 3 : Math.max(1, Math.round((r.interval || 3) * r.ease)));
    r.dueDay = today + r.interval;
  } else {
    r.lapses += 1; r.streak = 0; r.ease = _clampEase(r.ease - 0.2); r.interval = 1; r.dueDay = today + 1;
  }
  return r;
}
function masteryLevel(rec) {
  if (!rec || !rec.seen) return 0;
  if (rec.streak >= 4 && (rec.interval || 0) >= 14) return 3;
  if (rec.streak >= 2) return 2;
  return 1;
}
function conceptMastery(rec) {
  if (!rec || !rec.seen) return 0;
  const s = Math.min(1, rec.streak / 5);
  const iv = Math.min(1, (rec.interval || 0) / 21);
  return Math.max(0, Math.min(1, 0.6 * s + 0.4 * iv));
}
function todayNum(now) { return Math.floor((now == null ? Date.now() : now) / 86400000); }
function dueTopics(skill, today) {
  const out = [], sk = skill || {};
  for (const k in sk) if ((sk[k].seen || 0) > 0 && (sk[k].dueDay || 0) <= today) out.push(k);
  return out;
}

export {
  MODES, modeOf, BOSS_TIME, TOPIC_LIST, TOPIC_OF,
  hashStr, hardenTest,
  genGateSoup, genMuxMania, genSliceDice, genCounterFoundry, genCompareLab, genRangeDetect, genShiftShop,
  TRAINING_GENS, dailyFor,
  reviewInit, reviewUpdate, masteryLevel, conceptMastery, todayNum, dueTopics,
};
