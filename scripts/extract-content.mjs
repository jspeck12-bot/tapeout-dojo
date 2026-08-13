#!/usr/bin/env node
/**
 * Split the CONTENT / NG+ / training / gear block out of src/tapeout.jsx
 * into content/* data modules. Idempotent if the CONTENT banner is already gone.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srcPath = path.join(ROOT, 'src', 'tapeout.jsx');
let src = fs.readFileSync(srcPath, 'utf8');

if (!src.includes('// CONTENT — worlds, lessons, challenges, arcade, achievements')) {
  console.log('content already extracted');
  process.exit(0);
}

const lines = src.split('\n');
const grab = (a, b) => lines.slice(a - 1, b).join('\n');

const out = (rel, text) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
  console.log('wrote', rel, text.split('\n').length, 'lines');
};

out('content/util.js', `// Shared authoring helpers — RNG, number checks, exhaustive combinational benches.
${grab(177, 226)}

${grab(632, 659)}

export {
  mulberry32, rInt, rPick, toBin, toHex, normNum,
  checkDec, checkBin, checkHex, checkBinOrHex,
  combVecs, m8w,
};
`);

out('content/worlds.js', `${grab(228, 237)}

export { WORLDS };
`);

out('content/lessons.js', `${grab(239, 399)}

export { LESSONS, LESSON_DEPTH };
`);

out('content/gens.js', `import { rInt, rPick, toBin, toHex, checkDec, checkBin, checkHex, checkBinOrHex } from './util.js';

${grab(401, 597)}

export {
  genB1, genB2, genB3, genB4, genB5, genB6,
  genG1, genG3, genG4, genG5, genG6, genG7,
  genF1, genF4, genS8,
  GATE_FNS, F1_TABLE, f1Step,
};
`);

// gens.js currently includes GAUNTLETS at 599. grab 401-597 should be gens only.
// genG7 and genF4, genS8 are in 534-597 area. GAUNTLETS starts 599.

out('content/world-1/gauntlets.js', `import { genB1, genB2, genB3, genB4, genB5, genB6 } from '../gens.js';

export const GAUNTLETS = [
  { id: 'b1', world: 1, title: 'Binary Bedrock', xp: 30, gen: genB1, intro: 'Five conversions between binary and decimal, 4 bits at a time. The pickaxe work every engineer starts with.' },
  { id: 'b2', world: 1, title: 'Heavy Bits', xp: 30, gen: genB2, intro: 'Same game, full bytes. 8-bit conversions — learn to see 128s and 64s at a glance.' },
  { id: 'b3', world: 1, title: 'Hex Runes', xp: 30, gen: genB3, intro: 'Hex is binary with the boring parts compressed. One digit per nibble — never do math across the boundary.' },
  { id: 'b4', world: 1, title: 'The Sign Bit', xp: 35, gen: genB4, intro: "Two's complement reading. The MSB is negative; everything else is normal. Decode the values." },
  { id: 'b5', world: 1, title: 'Negation Ritual', xp: 35, gen: genB5, intro: 'Invert every bit, add one. Encode negative numbers the way the silicon does.' },
  { id: 'b6', world: 1, title: 'Overflow Omen', xp: 35, gen: genB6, intro: 'Ranges and the wraparound that ate a rocket. Know exactly where the cliff edge is.' },
];
`);

out('content/world-2/gauntlets.js', `import { genG1, genG3, genG4, genG5, genG6, genG7 } from '../gens.js';

export const GAUNTLETS = [
  { id: 'g1', world: 2, title: 'Meet the Gates', xp: 30, gen: genG1, intro: "A truth table is a gate's fingerprint. Identify the suspect from its prints." },
  { id: 'g3', world: 2, title: 'Universal Workshop', xp: 30, gen: genG3, intro: 'NAND and NOR can build anything — including each other. Work the inverted gates.' },
  { id: 'g4', world: 2, title: "De Morgan's Mirror", xp: 30, gen: genG4, intro: 'Break the bar, flip the operator. The most-used identity in all of digital design.' },
  { id: 'g5', world: 2, title: 'Boolean Cleanup', xp: 30, gen: genG5, intro: 'Fewer gates, same truth table. Simplify like a synthesis tool.' },
  { id: 'g6', world: 2, title: 'Bubble Pusher', xp: 35, gen: genG6, intro: 'Slide inversion bubbles through gates and watch AND and OR trade places.' },
  { id: 'g7', world: 2, title: 'Karnaugh Forge', xp: 35, gen: genG7, intro: 'Fewer gates, same truth. Spot the minimal form the way a Karnaugh map (and a synthesis tool) would.' },
];
`);

out('content/world-2/challenges.js', `${grab(617, 630)}

export { TRUTH_CHALLENGES };
`);

out('content/world-5/gauntlets.js', `import { genS8 } from '../gens.js';

export const GAUNTLETS = [
  { id: 's8', world: 5, title: 'Timing Trial', xp: 40, gen: genS8, intro: 'Registers only work if the data is there when the edge arrives. Setup, hold, and the clock period that ties them together.' },
];
`);

out('content/world-6/gauntlets.js', `import { genF1, genF4 } from '../gens.js';

export const GAUNTLETS = [
  { id: 'f1', world: 6, title: 'State Tracer', xp: 35, gen: genF1, intro: 'Before you build state machines, learn to BE one. Trace this "detect 10" Moore machine by hand, cycle by cycle.' },
  { id: 'f4', world: 6, title: 'Encoding Vault', xp: 40, gen: genF4, intro: 'Binary or one-hot? Count the flip-flops and weigh the trade. Moore versus Mealy while you are in here.' },
];
`);

// Split CODE_CHALLENGES_A into world 3 (m*) and world 4 (c*)
const codeA = grab(662, 825);
const mEnd = codeA.indexOf("    id: 'c1'");
if (mEnd < 0) throw new Error('could not split CODE_CHALLENGES_A at c1');
const mPart = codeA.slice(0, mEnd).replace('const CODE_CHALLENGES_A = [', 'export const CODE_CHALLENGES = [');
// close the array: mPart currently ends mid-array before c1 object. Need to trim trailing comma and close.
const mTrim = mPart.replace(/,\s*$/, '') + '\n];\n';
out('content/world-3/challenges.js', `import { combVecs } from '../util.js';

${mTrim}
`);

const cPart = 'export const CODE_CHALLENGES = [\n  ' + codeA.slice(mEnd).replace(/\];\s*$/, '') + '\n];\n';
out('content/world-4/challenges.js', `import { combVecs, m8w } from '../util.js';

${cPart}
`);

const codeB = grab(827, 1012);
const sEnd = codeB.indexOf("    id: 'f2'");
const f3 = codeB.indexOf("    id: 'chip1'");
if (sEnd < 0 || f3 < 0) throw new Error('could not split CODE_CHALLENGES_B');
const sPart = codeB.slice(0, sEnd).replace('const CODE_CHALLENGES_B = [', 'export const CODE_CHALLENGES = [');
out('content/world-5/challenges.js', `${sPart.replace(/,\s*$/, '')}\n];\n`);

const fPart = 'export const CODE_CHALLENGES = [\n  ' + codeB.slice(sEnd, f3);
out('content/world-6/challenges.js', `${fPart.replace(/,\s*$/, '')}\n];\n`);

const chipPart = 'export const CODE_CHALLENGES = [\n  ' + codeB.slice(f3).replace(/\];\s*$/, '') + '\n];\n';
out('content/world-7/challenges.js', chipPart);

out('content/bugs.js', `${grab(1016, 1102)}

export { BUG_HUNTS };
`);

out('content/blitz.js', `import { rInt, rPick, toBin, toHex, checkDec, checkBin, checkHex, checkBinOrHex } from './util.js';

${grab(1104, 1124)}

export { blitzGen };
`);

out('content/achievements.js', `${grab(1126, 1158)}

export { ACHIEVEMENTS, RANKS };
`);

out('content/remix.js', `import { combVecs } from './util.js';

${grab(1164, 1412)}

export { REMIX, defRemix };
`);

out('content/training.js', `import { mulberry32, rInt, rPick, combVecs } from './util.js';

${grab(1418, 1466)}

${grab(1470, 1609)}

export {
  MODES, modeOf, BOSS_TIME, TOPIC_LIST, TOPIC_OF,
  hashStr, hardenTest,
  genGateSoup, genMuxMania, genSliceDice, genCounterFoundry, genCompareLab, genRangeDetect, genShiftShop,
  TRAINING_GENS, dailyFor,
};
`);

out('content/gear.js', `${grab(1630, 1646)}

export { ITEMS, ITEM_BY_ID };
`);

out('content/order.js', `export const WORLD_ORDER = { b1: 1, b2: 2, b3: 3, b4: 4, b5: 5, b6: 6, g1: 1, g2: 2, g3: 3, g4: 4, g5: 5, g7: 6, g6: 7, m1: 1, m2: 2, m3: 3, m4: 4, m5: 5, m7: 6, m6: 7, c1: 1, c2: 2, c3: 3, c4: 4, c5: 5, c6: 6, c8: 7, c9: 8, c10: 9, c11: 10, c7: 11, s1: 1, s2: 2, s3: 3, s4: 4, s5: 5, s6: 6, s8: 7, s7: 8, f1: 1, f4: 2, f2: 3, f3: 4 };
`);

for (let w = 1; w <= 7; w++) {
  out(`content/world-${w}/lessons.js`, `import { LESSONS } from '../lessons.js';
export const lessons = LESSONS[${w}] || [];
export default lessons;
`);
}

console.log('data files written');
