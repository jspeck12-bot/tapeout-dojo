import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, test } from 'vitest';
import { SettingsScreen, SETTINGS_DEMO_SAVE, SCENES } from '../src/ui/SettingsScreen.jsx';
import { SettingsPanel } from '../src/ui/settings/SettingsPanel.jsx';
import { GearMark, SearchMark } from '../src/ui/components/icons.jsx';

const { createElement: h } = React;

const GFX = {
  exposure: 1.08, lights: 1.1, ambient: 0.92, fog: 0.032, normal: 0.95, glow: 0.7, bloom: 0.58,
};

describe('Silicon Gothic settings', () => {
  test('demo save and scenes cover graphics / difficulty / search', () => {
    expect(SETTINGS_DEMO_SAVE.sound).toBe(true);
    expect(SCENES.graphics.id).toBe('graphics');
    expect(SCENES.search.query).toBe('bloom');
  });

  test('GearMark / SearchMark stay geometric', () => {
    for (const Mark of [GearMark, SearchMark]) {
      let root;
      act(() => { root = TestRenderer.create(h(Mark, { size: 16 })); });
      expect(JSON.stringify(root.toJSON())).toContain('viewBox');
    }
  });

  test('SettingsPanel is searchable and has a live gfx preview', () => {
    let root;
    act(() => {
      root = TestRenderer.create(h(SettingsPanel, {
        save: SETTINGS_DEMO_SAVE,
        gfx: GFX,
        setGfx: () => {},
        setMode: () => {},
        toggleNg: () => {},
        toggleSound: () => {},
        go: () => {},
        onClose: () => {},
      }));
    });
    const json = root.toJSON();
    expect(json.props.className).toContain('sg-ui');
    expect(json.props['data-settings-status']).toBe('ready');
    const html = JSON.stringify(json);
    expect(html).toContain('SETTINGS');
    expect(html).toContain('bloom');
    expect(html).toContain('live graphics preview');
    expect(html).toContain('search settings');
    expect(html).not.toMatch(/style":\{[^}]*#[0-9a-fA-F]{3,8}/);
  });

  test('SettingsScreen exposes data-settings-status', async () => {
    let root;
    await act(async () => {
      root = TestRenderer.create(h(SettingsScreen, { go: () => {} }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    const json = root.toJSON();
    expect(json.props['data-settings-status']).toBe('ready');
    const text = JSON.stringify(json);
    expect(text).toContain('SETTINGS');
    expect(text).toContain('GRAPHICS');
    expect(text).toContain('fab controls');
  });
});
