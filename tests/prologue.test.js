import { describe, expect, test } from 'vitest';
import { firstDivergence } from '../src/engine/debug/diagnostics.js';
import { netlistOf } from '../src/engine/debug/netlist.js';
import { runChallengeTest, vCompile } from '../src/engine/verilog.js';
import {
  AND_IFACE,
  AND_STARTER,
  AND_TEST,
  DEBUG_IFACE,
  DEBUG_SOURCE,
  DEBUG_TEST,
  PROLOGUE_STEPS,
} from '../src/ui/PrologueScreen.jsx';

describe('guided prologue curriculum', () => {
  test('keeps the first RTL task scaffolded but genuinely test-driven', () => {
    const starter = vCompile(AND_STARTER, AND_IFACE);
    expect(starter.ok).toBe(true);
    expect(runChallengeTest(starter.mod, AND_TEST).pass).toBe(false);

    const corrected = vCompile(
      AND_STARTER.replace("assign y = 1'b0;", 'assign y = a & b;'),
      AND_IFACE,
    );
    expect(corrected.ok).toBe(true);
    expect(runChallengeTest(corrected.mod, AND_TEST).pass).toBe(true);
  });

  test('uses a deliberate sequential failure with actionable Debug Bay output', () => {
    const compiled = vCompile(DEBUG_SOURCE, DEBUG_IFACE);
    expect(compiled.ok).toBe(true);
    const result = runChallengeTest(compiled.mod, DEBUG_TEST);

    expect(result.pass).toBe(false);
    expect(result.trace.some((row) => !row.ok)).toBe(true);
    expect(firstDivergence(result, { q: 1 })).toMatch(/first divergence at cycle/);
    expect(netlistOf(compiled.mod).nodes.some((node) => node.type === 'DFF')).toBe(true);
  });

  test('retains every required onboarding beat in order', () => {
    expect(PROLOGUE_STEPS).toEqual([
      'wake',
      'playstyle',
      'controls',
      'field-note',
      'gauntlet',
      'first-rtl',
      'debug-bay',
      'release',
    ]);
  });
});
