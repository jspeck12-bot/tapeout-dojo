import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, test } from 'vitest';
import { FONT_DISPLAY, FONT_MONO, TOKEN_CSS, TOKENS } from '../src/ui/tokens.js';
import { Button } from '../src/ui/components/Button.jsx';
import { Panel } from '../src/ui/components/Panel.jsx';
import { UiKitScreen } from '../src/ui/UiKitScreen.jsx';

const { createElement: h } = React;

describe('Silicon Gothic UI kit', () => {
  test('exports a complete token map and CSS variable surface', () => {
    expect(TOKENS.color.brass).toMatch(/^#/);
    expect(TOKENS.color.cyan).toMatch(/^#/);
    expect(FONT_DISPLAY).toContain('Oxanium');
    expect(FONT_MONO).toContain('IBM Plex Mono');
    expect(TOKEN_CSS).toContain('--sg-brass:');
    expect(TOKEN_CSS).toContain('--sg-cyan:');
    expect(TOKEN_CSS).toContain('--sg-font-display:');
    expect(TOKEN_CSS).toContain('.sg-btn--primary');
    expect(TOKEN_CSS).toContain('.sg-panel');
    expect(TOKEN_CSS).toContain('.sg-menu-row');
    expect(TOKEN_CSS).toContain('--sg-motion-enter:');
    expect(TOKEN_CSS).toContain('prefers-reduced-motion');
  });

  test('Button and Panel render with token classes and no inline hex colors', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(
        h(Panel, { title: 'Bay' },
          h(Button, { variant: 'primary' }, 'run'),
          h(Button, { variant: 'brass', size: 'sm' }, 'forge'),
        ),
      );
    });
    const json = tree.toJSON();
    expect(json.props.className).toContain('sg-panel');
    const html = JSON.stringify(json);
    expect(html).toContain('sg-btn--primary');
    expect(html).toContain('sg-btn--brass');
    expect(html).toContain('sg-btn--sm');
    expect(html).not.toMatch(/style":\{[^}]*#[0-9a-fA-F]{3,8}/);
  });

  test('UiKitScreen exposes data-uikit-status and kit copy', async () => {
    let root;
    await act(async () => {
      root = TestRenderer.create(h(UiKitScreen, { go: () => {} }));
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    const json = root.toJSON();
    expect(json.props['data-uikit-status']).toBe('ready');
    expect(json.props.className).toContain('sg-ui');
    const text = JSON.stringify(json);
    expect(text).toContain('TAPEOUT');
    expect(text).toContain('Color tokens');
    expect(text).toContain('Buttons');
  });
});
