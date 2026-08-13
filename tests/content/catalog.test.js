import { describe, expect, test } from 'vitest';
import * as cat from '../../content/index.js';
import {
  validateCatalog, collectIds, loadManifest, diffManifest,
} from '../../content/schema.js';
import { vCompile, runChallengeTest } from '../../src/engine/core.js';
import { analyzeTiming } from '../../src/engine/timing.js';

describe('catalog schema and ID immutability', () => {
  test('schema violations are empty on the shipped catalog', () => {
    const errors = validateCatalog(cat);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('removing a shipped ID is reported', () => {
    const current = collectIds(cat);
    const shipped = loadManifest();
    expect(diffManifest(current, shipped)).toEqual([]);
    const missing = diffManifest(
      { ...current, challenge: current.challenge.filter((id) => id !== 'm1') },
      shipped,
    );
    expect(missing.some((m) => m.id === 'm1' && m.kind === 'challenge')).toBe(true);
  });

  test('content count is 28 Verilog challenges', () => {
    expect(cat.CODE_CHALLENGES.length).toBe(28);
  });
});

describe('canonical solutions (unmodified)', () => {
  test('every solution compiles, passes, and yields a timing report', () => {
    for (const ch of cat.CODE_CHALLENGES) {
      const c = vCompile(ch.solution, ch.iface);
      expect(c.ok, `${ch.id}: ${c.errors && c.errors[0] && c.errors[0].msg}`).toBe(true);
      const r = runChallengeTest(c.mod, ch.test);
      expect(r.pass && !r.runtimeError, `${ch.id} failed ${r.passCount}/${r.total}`).toBe(true);
      const t = analyzeTiming(c.mod);
      expect(Number.isFinite(t.pathDepth)).toBe(true);
    }
  });
});
