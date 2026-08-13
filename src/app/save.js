import { rpgFix } from '../game/rpg.js';

const SAVE_KEY = 'tapeout_save_v1'; // legacy single-save (auto-migrated to slot 1)
const META_KEY = 'tapeout_meta_v1';
const SLOT_KEY = (n) => 'tapeout_slot_' + n;
const normalizeSlot = (value) => [1, 2, 3].includes(Number(value)) ? Number(value) : 1;
const DEFAULT_SAVE = {
  v: 2, xp: 0, done: {}, lessons: {}, ach: [],
  blitzHigh: 0, comboBest: 0, bugsSolved: [], bugClean: [],
  streak: { last: null, count: 0 }, sound: true, tapeoutDone: false,
  mode: 'apprentice', ngplus: false, doneNg: {},
  training: {}, trainTotal: 0, dailyDone: {}, dailyCount: 0,
  stats: { topics: {}, playMs: 0, runs: 0 },
  skill: {},
  noteRecall: {},
  exploration: { graces: {}, lore: {}, caches: {}, discovered: {} },
  remembrances: {},
  campusVisited: false,
  tutorial: { completed: false, skipped: false, step: 0, replays: 0 },
};
function normalizeSave(p) { return rpgFix(normalizeSaveBase(p)); }
function cloneSaveForMutation(previous) {
  const source = normalizeSave(previous);
  return {
    ...source,
    done: { ...source.done },
    doneNg: { ...source.doneNg },
    lessons: { ...source.lessons },
    ach: [...source.ach],
    skill: { ...source.skill },
    noteRecall: { ...source.noteRecall },
    exploration: {
      graces: { ...source.exploration.graces },
      lore: { ...source.exploration.lore },
      caches: { ...source.exploration.caches },
      discovered: { ...source.exploration.discovered },
    },
    remembrances: { ...source.remembrances },
    bugsSolved: [...source.bugsSolved],
    bugClean: [...source.bugClean],
    streak: { ...source.streak },
    training: { ...source.training },
    dailyDone: { ...source.dailyDone },
    stats: { ...source.stats, topics: { ...source.stats.topics } },
    gear: { ...source.gear },
    inv: { ...source.inv },
    combat: { ...source.combat },
    owned: [...source.owned],
    tutorial: { ...source.tutorial },
  };
}
function normalizeSaveBase(p) {
  const q = p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  const objectOf = (value) =>
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const arrayOf = (value) => Array.isArray(value) ? value : [];
  const countOf = (value) =>
    Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const stats = objectOf(q.stats);
  const tutorial = objectOf(q.tutorial);
  const exploration = objectOf(q.exploration);
  const hasLegacyProgress = !!p && (
    countOf(q.xp) > 0 ||
    Object.keys(objectOf(q.done)).length > 0 ||
    Object.keys(objectOf(q.lessons)).length > 0 ||
    !!q.campusVisited
  );
  return {
    ...DEFAULT_SAVE, ...q,
    xp: countOf(q.xp),
    blitzHigh: countOf(q.blitzHigh),
    comboBest: countOf(q.comboBest),
    trainTotal: countOf(q.trainTotal),
    dailyCount: countOf(q.dailyCount),
    done: { ...objectOf(q.done) }, doneNg: { ...objectOf(q.doneNg) },
    lessons: { ...objectOf(q.lessons) }, ach: [...arrayOf(q.ach)],
    bugsSolved: [...arrayOf(q.bugsSolved)], bugClean: [...arrayOf(q.bugClean)],
    streak: {
      ...DEFAULT_SAVE.streak,
      ...objectOf(q.streak),
      count: countOf(objectOf(q.streak).count),
    },
    training: { ...objectOf(q.training) }, dailyDone: { ...objectOf(q.dailyDone) },
    stats: {
      topics: { ...objectOf(stats.topics) },
      playMs: countOf(stats.playMs),
      runs: countOf(stats.runs),
    },
    skill: { ...objectOf(q.skill) },
    noteRecall: { ...objectOf(q.noteRecall) },
    exploration: {
      graces: { ...objectOf(exploration.graces) },
      lore: { ...objectOf(exploration.lore) },
      caches: { ...objectOf(exploration.caches) },
      discovered: { ...objectOf(exploration.discovered) },
    },
    remembrances: { ...objectOf(q.remembrances) },
    sound: typeof q.sound === 'boolean' ? q.sound : DEFAULT_SAVE.sound,
    tapeoutDone: !!q.tapeoutDone,
    ngplus: !!q.ngplus,
    campusVisited: !!q.campusVisited,
    tutorial: {
      completed: typeof tutorial.completed === 'boolean'
        ? tutorial.completed
        : hasLegacyProgress,
      skipped: !!tutorial.skipped,
      step: Math.min(7, countOf(tutorial.step)),
      replays: countOf(tutorial.replays),
    },
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
  normalizeSlot,
  DEFAULT_SAVE,
  normalizeSave,
  cloneSaveForMutation,
  normalizeSaveBase,
  todayStr,
  yesterdayStr,
};
