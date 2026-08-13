import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, test } from 'vitest';
import { ExploreHud } from '../src/ui/hud/ExploreHud.jsx';
import { HudScreen, HUD_DEMO_SAVE, SCENES } from '../src/ui/HudScreen.jsx';
import { HudMark, MapMark, BackMark } from '../src/ui/components/icons.jsx';

const { createElement: h } = React;

describe('Silicon Gothic operator HUD', () => {
  test('HUD_DEMO_SAVE and SCENES cover explore / sealed / campus', () => {
    expect(HUD_DEMO_SAVE.xp).toBeGreaterThan(0);
    expect(HUD_DEMO_SAVE.scrap).toBeGreaterThan(0);
    expect(SCENES.explore.zone).toContain('FOUNDRY');
    expect(SCENES.sealed.prompt.locked).toBe(true);
    expect(SCENES.campus.fakeMinimap).toBe(true);
  });

  test('HudMark / MapMark / BackMark stay geometric', () => {
    for (const Mark of [HudMark, MapMark, BackMark]) {
      let root;
      act(() => { root = TestRenderer.create(h(Mark, { size: 16 })); });
      expect(JSON.stringify(root.toJSON())).toContain('viewBox');
    }
  });

  test('ExploreHud renders vitals, zone, prompt, and reticle', () => {
    let root;
    act(() => {
      root = TestRenderer.create(h(ExploreHud, {
        accent: 'brass',
        save: HUD_DEMO_SAVE,
        zone: 'THE FOUNDRY FLOOR',
        prompt: { text: '[E] ENGAGE', locked: false },
        showHelp: false,
        onMenu: () => {},
        onMap: () => {},
      }));
    });
    const json = root.toJSON();
    expect(json.props['data-explore-hud']).toBe('1');
    expect(json.props['data-accent']).toBe('brass');
    const text = JSON.stringify(json);
    expect(text).toContain('THE FOUNDRY FLOOR');
    expect(text).toContain('[E] ENGAGE');
    expect(text).toContain('Lv ');
    expect(text).toContain('XP');
    expect(text).toContain('ehud-reticle');
    expect(text).toContain('menu');
    expect(text).toContain('map');
  });

  test('ExploreHud hides when hidden and marks locked prompts', () => {
    let root;
    act(() => {
      root = TestRenderer.create(h(ExploreHud, {
        hidden: true,
        save: HUD_DEMO_SAVE,
        zone: 'X',
      }));
    });
    expect(root.toJSON()).toBeNull();

    act(() => {
      root = TestRenderer.create(h(ExploreHud, {
        save: HUD_DEMO_SAVE,
        prompt: { text: 'SEALED', locked: true },
      }));
    });
    const html = JSON.stringify(root.toJSON());
    expect(html).toContain('data-locked\":\"1\"');
    expect(html).toContain('SEALED');
  });

  test('HudScreen exposes data-hud-status and operator copy', async () => {
    let root;
    await act(async () => {
      root = TestRenderer.create(h(HudScreen, { go: () => {} }));
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    const json = root.toJSON();
    expect(json.props['data-hud-status']).toBe('ready');
    expect(json.props.className).toContain('sg-ui');
    const text = JSON.stringify(json);
    expect(text).toContain('OPERATOR HUD');
    expect(text).toContain('THE FOUNDRY FLOOR');
    expect(text).toContain('ENGAGE STATION');
    expect(text).toContain('data-explore-hud');
    expect(text).toContain('EXPLORE');
    expect(text).toContain('SEALED');
  });
});
