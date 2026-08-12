import { GAUNTLETS, TRUTH_CHALLENGES, CODE_CHALLENGES } from '../game/content.js';

const ALL_CHALLENGES = [];
GAUNTLETS.forEach(g => ALL_CHALLENGES.push({ kind: 'gauntlet', id: g.id, world: g.world, title: g.title, xp: g.xp, boss: g.boss, def: g }));
TRUTH_CHALLENGES.forEach(t => ALL_CHALLENGES.push({ kind: 'truth', id: t.id, world: t.world, title: t.title, xp: t.xp, def: t }));
CODE_CHALLENGES.forEach(c => ALL_CHALLENGES.push({ kind: 'code', id: c.id, world: c.world, title: c.title, xp: c.xp, boss: c.boss, def: c }));

const WORLD_ORDER = { b1: 1, b2: 2, b3: 3, b4: 4, b5: 5, b6: 6, g1: 1, g2: 2, g3: 3, g4: 4, g5: 5, g7: 6, g6: 7, m1: 1, m2: 2, m3: 3, m4: 4, m5: 5, m7: 6, m6: 7, c1: 1, c2: 2, c3: 3, c4: 4, c5: 5, c6: 6, c8: 7, c9: 8, c10: 9, c11: 10, c7: 11, s1: 1, s2: 2, s3: 3, s4: 4, s5: 5, s6: 6, s8: 7, s7: 8, f1: 1, f4: 2, f2: 3, f3: 4 };
function challengesOf(w) {
  return ALL_CHALLENGES.filter(c => c.world === w).sort((a, b) => (WORLD_ORDER[a.id] || 99) - (WORLD_ORDER[b.id] || 99) || a.id.localeCompare(b.id));
}
function worldDone(w, save) { return challengesOf(w).every(c => save.done[c.id]); }
function activeDone(save) { return save.ngplus ? (save.doneNg || {}) : save.done; }
function worldUnlockedEx(w, save) { return save.ngplus ? true : worldUnlocked(w, save); }
function worldUnlocked(w, save) {
  if (w === 1) return true;
  if (w === 7) return [1, 2, 3, 4, 5, 6].every(x => worldDone(x, save));
  return worldDone(w - 1, save);
}

export {
  ALL_CHALLENGES, WORLD_ORDER, challengesOf, worldDone, activeDone,
  worldUnlocked, worldUnlockedEx,
};
