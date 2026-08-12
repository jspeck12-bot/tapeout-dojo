import { rpgFix } from '../game/rpg.js';

const SAVE_KEY = 'tapeout_save_v1'; // legacy single-save (auto-migrated to slot 1)
const META_KEY = 'tapeout_meta_v1';
const SLOT_KEY = (n) => 'tapeout_slot_' + n;
const DEFAULT_SAVE = {
  v: 2, xp: 0, done: {}, lessons: {}, ach: [],
  blitzHigh: 0, comboBest: 0, bugsSolved: [], bugClean: [],
  streak: { last: null, count: 0 }, sound: true, tapeoutDone: false,
  mode: 'apprentice', ngplus: false, doneNg: {},
  training: {}, trainTotal: 0, dailyDone: {}, dailyCount: 0,
  stats: { topics: {}, playMs: 0, runs: 0 },
  skill: {},
  campusVisited: false,
};
function normalizeSave(p) { return rpgFix(normalizeSaveBase(p)); }
function normalizeSaveBase(p) {
  const q = p || {};
  return {
    ...DEFAULT_SAVE, ...q,
    done: { ...(q.done || {}) }, doneNg: { ...(q.doneNg || {}) },
    lessons: { ...(q.lessons || {}) }, ach: [...(q.ach || [])],
    bugsSolved: [...(q.bugsSolved || [])], bugClean: [...(q.bugClean || [])],
    streak: { ...DEFAULT_SAVE.streak, ...(q.streak || {}) },
    training: { ...(q.training || {}) }, dailyDone: { ...(q.dailyDone || {}) },
    stats: {
      topics: { ...((q.stats && q.stats.topics) || {}) },
      playMs: (q.stats && q.stats.playMs) || 0,
      runs: (q.stats && q.stats.runs) || 0,
    },
    skill: { ...(q.skill || {}) },
    mode: ['apprentice', 'engineer', 'architect'].includes(q.mode) ? q.mode : 'apprentice',
    v: 2,
  };
}
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

export {
  SAVE_KEY,
  META_KEY,
  SLOT_KEY,
  DEFAULT_SAVE,
  normalizeSave,
  normalizeSaveBase,
  todayStr,
  yesterdayStr,
};
