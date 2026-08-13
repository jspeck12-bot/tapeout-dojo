import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, test } from 'vitest';
import { CHANNELS, DebugBayScreen, runDiagnostic } from '../src/ui/DebugBayScreen.jsx';
import { ScopeMark } from '../src/ui/components/icons.jsx';

const { createElement: h } = React;

describe('Silicon Gothic Debug Bay', () => {
  test('probe channels cover clk + DUT signals', () => {
    expect(CHANNELS.map(c => c.id)).toEqual(['clk', 'rst', 'd', 'q']);
    expect(CHANNELS.every(c => c.label && c.role)).toBe(true);
  });

  test('runDiagnostic latches the prologue DFF fault', () => {
    const diag = runDiagnostic();
    expect(diag.ok).toBe(true);
    expect(diag.pass).toBe(false);
    expect(diag.mod).toBeTruthy();
    expect(diag.result?.trace?.length).toBeGreaterThan(0);
    expect(String(diag.diagnosis).toLowerCase()).toMatch(/q|cycle|diverge|mismatch|expect/);
  });

  test('ScopeMark stays geometric (no lucide paths)', () => {
    let root;
    act(() => {
      root = TestRenderer.create(h(ScopeMark, { size: 16 }));
    });
    expect(JSON.stringify(root.toJSON())).toContain('viewBox');
  });

  test('DebugBayScreen exposes data-debugbay-status and bay copy', async () => {
    let root;
    await act(async () => {
      root = TestRenderer.create(h(DebugBayScreen, { go: () => {} }));
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    const json = root.toJSON();
    expect(json.props['data-debugbay-status']).toBe('ready');
    expect(json.props.className).toContain('sg-ui');
    const text = JSON.stringify(json);
    expect(text).toContain('DEBUG BAY');
    expect(text).toContain('Scope face');
    expect(text).toContain('Probe rack');
    expect(text).toContain('tutorial_dff');
    expect(text).toContain('RUN DIAGNOSTIC');
    expect(text).toContain('NETLIST');
    expect(text).toContain('SCOPE');
    expect(text).toContain('"data-diagnosis":"1"');
    expect(text).toContain('CLK');
  });
});
