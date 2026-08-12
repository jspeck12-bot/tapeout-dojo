import { describe, expect, test } from 'vitest';
import { DEFAULT_SAVE, normalizeSave } from '../src/app/save.js';
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
});
