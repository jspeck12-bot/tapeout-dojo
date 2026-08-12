import { describe, expect, test } from 'vitest';
import {
  DEFAULT_SAVE,
  SLOT_KEY,
  cloneSaveForMutation,
  normalizeSave,
  normalizeSlot,
} from '../src/app/save.js';
import { exportSave, importSave } from '../src/ui/meta.jsx';

describe('save compatibility', () => {
  test('normalizes legacy and malformed nested fields without losing progress', () => {
    const normalized = normalizeSave({
      xp: 240,
      done: { m1: { stars: 3 } },
      lessons: null,
      streak: null,
      gear: { weapon: 'missing', armor: 'missing', tool: 'missing' },
      inv: { potions: 99, flux: -4 },
    });

    expect(normalized.xp).toBe(240);
    expect(normalized.done.m1.stars).toBe(3);
    expect(normalized.lessons).toEqual({});
    expect(normalized.streak).toEqual(DEFAULT_SAVE.streak);
    expect(normalized.gear).toEqual({ weapon: 'w_iron', armor: 'a_cloth', tool: null });
    expect(normalized.inv).toEqual({ potions: 5, flux: 0 });
    expect(normalized.owned).toEqual(expect.arrayContaining(['w_iron', 'a_cloth']));
  });

  test('round-trips Unicode and complete progression through a TPO1 code', () => {
    const save = normalizeSave({
      xp: 1234,
      done: { m1: { stars: 3, mode: 'engineer' } },
      lessons: { L3a: true },
      notes: 'Ω silicon ✓',
    });
    const code = exportSave(save);
    const restored = importSave(code);

    expect(code.startsWith('TPO1.')).toBe(true);
    expect(restored).toEqual(save);
  });

  test('rejects a save code whose payload was modified', () => {
    const code = exportSave(normalizeSave({ xp: 12 }));
    const parts = code.split('.');
    const replacement = parts[1][0] === 'A' ? 'B' : 'A';
    parts[1] = replacement + parts[1].slice(1);

    expect(() => importSave(parts.join('.'))).toThrow(/Checksum mismatch/);
  });

  test('rejects correctly checksummed payloads without core fields', () => {
    expect(() => importSave(exportSave({}))).toThrow(/missing core fields/);
  });

  test('sanitizes hostile but valid JSON field types before App state uses them', () => {
    const normalized = normalizeSave({
      xp: -40,
      scrap: -5,
      ach: {},
      bugsSolved: 'm1',
      bugClean: 7,
      done: [],
      stats: { topics: [], playMs: -1, runs: 'many' },
      skill: [],
      sound: 'yes',
      dailyCount: Number.POSITIVE_INFINITY,
    });

    expect(normalized.xp).toBe(0);
    expect(normalized.scrap).toBe(0);
    expect(normalized.ach).toEqual([]);
    expect(normalized.bugsSolved).toEqual([]);
    expect(normalized.bugClean).toEqual([]);
    expect(normalized.done).toEqual({});
    expect(normalized.stats).toEqual({ topics: {}, playMs: 0, runs: 0 });
    expect(normalized.skill).toEqual({});
    expect(normalized.sound).toBe(true);
    expect(normalized.dailyCount).toBe(0);
  });

  test('keeps persisted profile selection inside the three real slots', () => {
    expect(normalizeSlot(1)).toBe(1);
    expect(normalizeSlot('3')).toBe(3);
    expect(normalizeSlot(0)).toBe(1);
    expect(normalizeSlot(999)).toBe(1);
    expect(normalizeSlot('broken')).toBe(1);
    expect(new Set([SLOT_KEY(1), SLOT_KEY(2), SLOT_KEY(3)]).size).toBe(3);
  });

  test('clones every nested branch mutated by App callbacks', () => {
    const previous = normalizeSave({
      done: { m1: { stars: 1 } },
      gear: { weapon: 'w_iron', armor: 'a_cloth', tool: null },
      inv: { potions: 2, flux: 1 },
      combat: { kills: 3, deaths: 1, flawless: 2 },
      owned: ['w_iron', 'a_cloth'],
    });
    const next = cloneSaveForMutation(previous);

    for (const key of [
      'done', 'doneNg', 'lessons', 'ach', 'skill', 'bugsSolved', 'bugClean',
      'streak', 'training', 'dailyDone', 'stats', 'gear', 'inv', 'combat', 'owned',
      'tutorial',
    ]) {
      expect(next[key]).not.toBe(previous[key]);
    }
    expect(next.stats.topics).not.toBe(previous.stats.topics);

    next.inv.potions--;
    next.combat.kills++;
    next.gear.weapon = 'w_copper';
    next.owned.push('w_copper');
    expect(previous.inv.potions).toBe(2);
    expect(previous.combat.kills).toBe(3);
    expect(previous.gear.weapon).toBe('w_iron');
    expect(previous.owned).not.toContain('w_copper');
  });

  test('starts fresh saves in the prologue without surprising legacy players', () => {
    expect(normalizeSave(null).tutorial).toEqual({
      completed: false,
      skipped: false,
      step: 0,
      replays: 0,
    });
    expect(normalizeSave({ xp: 80, done: {}, lessons: {} }).tutorial.completed).toBe(true);
    expect(normalizeSave({
      xp: 80,
      tutorial: { completed: false, skipped: false, step: 99 },
    }).tutorial).toEqual({
      completed: false,
      skipped: false,
      step: 7,
      replays: 0,
    });
  });
});
