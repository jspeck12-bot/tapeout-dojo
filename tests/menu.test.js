import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, test } from 'vitest';
import { MainMenu } from '../src/ui/menu.jsx';
import { TOKEN_CSS } from '../src/ui/tokens.js';
import { MenuRow } from '../src/ui/components/MenuRow.jsx';
import { PlayMark } from '../src/ui/components/icons.jsx';

const { createElement: h } = React;

const save = {
  xp: 321,
  scrap: 12,
  skill: {},
  done: {},
  tapeoutDone: false,
  ngplus: false,
};

describe('Silicon Gothic main menu', () => {
  test('token CSS includes menu-row surface', () => {
    expect(TOKEN_CSS).toContain('.sg-menu-row');
    expect(TOKEN_CSS).toContain('.sg-menu-row--primary');
    expect(TOKEN_CSS).toContain('.sg-menu-row--danger');
  });

  test('MenuRow uses token classes without inline hex colors', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(
        h(MenuRow, {
          variant: 'primary',
          icon: h(PlayMark, { size: 16 }),
          title: 'CONTINUE',
          hint: 'resume',
          onClick: () => {},
        }),
      );
    });
    const json = tree.toJSON();
    expect(json.props.className).toContain('sg-menu-row');
    expect(json.props.className).toContain('sg-menu-row--primary');
    const html = JSON.stringify(json);
    expect(html).not.toMatch(/style":\{[^}]*#[0-9a-fA-F]{3,8}/);
  });

  test('MainMenu exposes data-menu-status and core entries', async () => {
    let root;
    await act(async () => {
      root = TestRenderer.create(
        h(MainMenu, {
          save,
          go: () => {},
          onSettings: () => {},
          onNewGame: () => {},
          onReplayTutorial: () => {},
        }),
      );
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    const json = root.toJSON();
    expect(json.props['data-menu-status']).toBe('ready');
    expect(json.props.className).toContain('sg-ui');
    const text = JSON.stringify(json);
    expect(text).toContain('TAPEOUT');
    expect(text).toContain('CONTINUE');
    expect(text).toContain('NEW GAME');
    expect(text).toContain('CODEX & MASTERY DIE');
    expect(text).toContain('SETTINGS');
    expect(text).toContain('sg-menu-row--primary');
  });
});
