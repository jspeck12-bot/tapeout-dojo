import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, test } from 'vitest';
import { EditorState } from '@codemirror/state';
import { WorkbenchScreen, STARTER, SOLUTION } from '../src/ui/WorkbenchScreen.jsx';
import { buildEditorExtensions, verilogCompletions, VERILOG_SNIPPETS } from '../src/ui/workbench/extensions.js';
import { siliconGothicTheme, THEME_COLORS } from '../src/ui/workbench/theme.js';

const { createElement: h } = React;

describe('Silicon Gothic CodeMirror workbench', () => {
  test('theme pulls Silicon Gothic token colors', () => {
    expect(THEME_COLORS.brass).toMatch(/^#/);
    expect(THEME_COLORS.cyan).toMatch(/^#/);
    expect(THEME_COLORS.bgDeep).toMatch(/^#/);
    expect(siliconGothicTheme).toBeTruthy();
  });

  test('editor extensions include Verilog language, gutters, autocomplete stack', () => {
    const exts = buildEditorExtensions({ onRun: () => {} });
    const state = EditorState.create({
      doc: 'module t; endmodule\n',
      extensions: exts,
    });
    expect(state.doc.lines).toBeGreaterThan(0);
    expect(state.facet(EditorState.tabSize)).toBeTruthy();
    // Completions: keywords + snippets
    const ctx = {
      matchBefore: () => ({ from: 0, to: 3, text: 'mod' }),
      explicit: true,
    };
    const result = verilogCompletions(ctx);
    expect(result.options.some(o => o.label === 'module')).toBe(true);
    expect(result.options.some(o => o.label === 'always')).toBe(true);
    expect(VERILOG_SNIPPETS.length).toBeGreaterThanOrEqual(3);
  });

  test('starter and solution differ so the merge pane has a real delta', () => {
    expect(STARTER).toContain('1\'b0');
    expect(SOLUTION).toContain('a & b');
    expect(STARTER).not.toBe(SOLUTION);
  });

  test('WorkbenchScreen exposes data-workbench-status and capability copy', async () => {
    let root;
    await act(async () => {
      root = TestRenderer.create(h(WorkbenchScreen, { go: () => {} }));
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    const json = root.toJSON();
    expect(json.props['data-workbench-status']).toBe('ready');
    expect(json.props.className).toContain('sg-ui');
    const text = JSON.stringify(json);
    expect(text).toContain('TAPEOUT');
    expect(text).toContain('RTL editor');
    expect(text).toContain('verilog');
    expect(text).toContain('Diff');
    expect(text).toContain('autocomplete');
  });
});
