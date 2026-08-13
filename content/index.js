// Content catalog — worlds, lessons, challenges, gauntlets, gear.
// Adding a Verilog challenge: one object in content/world-N/challenges.js. No other code edits.
// IDs are immutable (they key the save file). See content/README.md and ids.manifest.json.

import { WORLDS } from './worlds.js';
import { LESSONS, LESSON_DEPTH } from './lessons.js';
import { CODE_CHALLENGES as CODE_W3 } from './world-3/challenges.js';
import { CODE_CHALLENGES as CODE_W4 } from './world-4/challenges.js';
import { CODE_CHALLENGES as CODE_W5 } from './world-5/challenges.js';
import { CODE_CHALLENGES as CODE_W6 } from './world-6/challenges.js';
import { CODE_CHALLENGES as CODE_W7 } from './world-7/challenges.js';
import { GAUNTLETS as G1 } from './world-1/gauntlets.js';
import { GAUNTLETS as G2 } from './world-2/gauntlets.js';
import { GAUNTLETS as G5 } from './world-5/gauntlets.js';
import { GAUNTLETS as G6 } from './world-6/gauntlets.js';
import { TRUTH_CHALLENGES } from './world-2/challenges.js';
import { REMIX } from './remix.js';
import { WORLD_ORDER } from './order.js';
import { ACHIEVEMENTS, RANKS } from './achievements.js';
import { ITEMS, ITEM_BY_ID } from './gear.js';
import { BUG_HUNTS } from './bugs.js';
import { blitzGen } from './blitz.js';
import {
  MODES, modeOf, BOSS_TIME, TOPIC_LIST, TOPIC_OF,
  hashStr, hardenTest, TRAINING_GENS, dailyFor,
  reviewInit, reviewUpdate, masteryLevel, conceptMastery, todayNum, dueTopics,
} from './training.js';
import {
  mulberry32, rInt, rPick, toBin, toHex, combVecs, m8w,
  checkDec, checkBin, checkHex, checkBinOrHex,
} from './util.js';

export const CODE_CHALLENGES = [].concat(CODE_W3, CODE_W4, CODE_W5, CODE_W6, CODE_W7);
export const GAUNTLETS = [].concat(G1, G2, G5, G6);

CODE_CHALLENGES.forEach((ch) => { ch.testHard = hardenTest(ch); });
Object.keys(REMIX).forEach((id) => {
  const r = REMIX[id];
  const base = CODE_CHALLENGES.find((c) => c.id === id);
  r.id = id + '+';
  r.world = base.world;
  r.testHard = hardenTest(r);
  r.hints = r.hints || [];
  r.starter = r.starter || '';
});

export const ALL_CHALLENGES = [];
GAUNTLETS.forEach((g) => ALL_CHALLENGES.push({ kind: 'gauntlet', id: g.id, world: g.world, title: g.title, xp: g.xp, def: g }));
TRUTH_CHALLENGES.forEach((t) => ALL_CHALLENGES.push({ kind: 'truth', id: t.id, world: t.world, title: t.title, xp: t.xp, def: t }));
CODE_CHALLENGES.forEach((c) => ALL_CHALLENGES.push({ kind: 'code', id: c.id, world: c.world, title: c.title, xp: c.xp, boss: c.boss, def: c }));

function challengesOf(w) {
  return ALL_CHALLENGES.filter((c) => c.world === w).sort((a, b) => (WORLD_ORDER[a.id] || 99) - (WORLD_ORDER[b.id] || 99) || a.id.localeCompare(b.id));
}

export {
  WORLDS, LESSONS, LESSON_DEPTH,
  TRUTH_CHALLENGES, REMIX, WORLD_ORDER,
  ACHIEVEMENTS, RANKS, ITEMS, ITEM_BY_ID, BUG_HUNTS, blitzGen,
  MODES, modeOf, BOSS_TIME, TOPIC_LIST, TOPIC_OF,
  hashStr, hardenTest, TRAINING_GENS, dailyFor,
  reviewInit, reviewUpdate, masteryLevel, conceptMastery, todayNum, dueTopics,
  mulberry32, rInt, rPick, toBin, toHex, combVecs, m8w,
  checkDec, checkBin, checkHex, checkBinOrHex,
  challengesOf,
};
