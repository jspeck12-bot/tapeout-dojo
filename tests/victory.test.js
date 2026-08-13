import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, test } from 'vitest';
import { VictoryScreen, SCENES } from '../src/ui/VictoryScreen.jsx';
import { VictoryReport, ProbeBins } from '../src/ui/victory/VictoryReport.jsx';
import { FailMark, YieldMark } from '../src/ui/components/icons.jsx';
import { TOKENS } from '../src/ui/tokens.js';
import { FlatlineOverlay, LevelUpModal } from '../src/ui/combat.jsx';

const { createElement: h } = React;

describe('Silicon Gothic yield report', () => {
  test('SCENES cover signoff, zero-defect, boss, flatline, promote', () => {
    expect(SCENES.signoff.title).toBe('SIGNED OFF');
    expect(SCENES.flawless.stars).toBe(3);
    expect(SCENES.boss.kicker).toContain('boss');
    expect(SCENES.flatline.tone).toBe('danger');
    expect(SCENES.levelup.title).toContain('LEVEL');
  });

  test('YieldMark / FailMark stay geometric', () => {
    for (const Mark of [YieldMark, FailMark]) {
      let root;
      act(() => { root = TestRenderer.create(h(Mark, { size: 16 })); });
      expect(JSON.stringify(root.toJSON())).toContain('viewBox');
    }
  });

  test('ProbeBins lights the signed bins', () => {
    let root;
    act(() => { root = TestRenderer.create(h(ProbeBins, { n: 2 })); });
    const html = JSON.stringify(root.toJSON());
    expect(html).toContain('2 of 3 probe bins');
    expect(html.match(/is-lit/g).length).toBe(2);
  });

  test('VictoryReport uses token classes without inline hex', () => {
    let root;
    act(() => {
      root = TestRenderer.create(h(VictoryReport, {
        overlay: true,
        still: true,
        tone: 'ok',
        kicker: 'yield report',
        title: 'SIGNED OFF',
        body: 'clean lot',
        stars: 2,
        stats: [{ id: 'scrap', label: 'reclaimed', value: 38, prefix: '+', accent: 'brass' }],
        primary: { label: 'continue', onClick: () => {} },
      }));
    });
    const json = root.toJSON();
    expect(json.props.className).toContain('sg-ui');
    expect(json.props['data-victory-overlay']).toBe('1');
    const html = JSON.stringify(json);
    expect(html).toContain('SIGNED OFF');
    expect(html).toContain('reclaimed');
    expect(html).toContain('data-stat-value":38');
    expect(html).not.toMatch(/style":\{[^}]*#[0-9a-fA-F]{3,8}/);
  });

  test('VictoryScreen exposes data-victory-status and report copy', async () => {
    let root;
    await act(async () => {
      root = TestRenderer.create(h(VictoryScreen, { go: () => {} }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    const json = root.toJSON();
    expect(json.props['data-victory-status']).toBe('ready');
    expect(json.props.className).toContain('sg-ui');
    const text = JSON.stringify(json);
    expect(text).toContain('YIELD REPORT');
    expect(text).toContain('SIGNED OFF');
    expect(text).toContain('ZERO DEFECT');
    expect(text).toContain('FLATLINE');
    expect(text).toContain('lot ticket');
    expect(text).toContain('fab checkout');
    expect(json.props['data-victory-scene']).toBe('signoff');
    expect(json.props['data-victory-still']).toBe('0');
  });

  test('FlatlineOverlay keeps FLATLINED copy and crawl-back', async () => {
    const retreat = { called: 0, loss: 0 };
    const combat = {
      enemy: { name: 'NAND Golem', scrap: 40 },
      loot: { kind: 'dead', scrapLoss: 24 },
      retreatDead: () => { retreat.called += 1; retreat.loss = 24; return 24; },
    };
    let root;
    await act(async () => {
      root = TestRenderer.create(h(FlatlineOverlay, {
        c: combat,
        onRetreat: () => { retreat.called += 10; },
      }));
    });
    const text = JSON.stringify(root.toJSON());
    expect(text).toContain('FLATLINED');
    expect(text).toContain('crawl back');
    expect(text).toContain('nand golem');
    expect(retreat.called).toBe(1);
    expect(TOKENS.motion.enter).toBe('320ms');
  });

  test('LevelUpModal shows promotion stats on tokens', () => {
    let root;
    act(() => {
      root = TestRenderer.create(h(LevelUpModal, {
        info: { from: 4, to: 5 },
        save: { xp: 400, gear: { weapon: 'w_iron', armor: 'a_cloth' } },
        onClose: () => {},
      }));
    });
    const text = JSON.stringify(root.toJSON());
    expect(text).toContain('Lv 4 → 5');
    expect(text).toContain('lot ticket');
    expect(text).toContain('onward');
    expect(text).toContain('process credit');
  });
});
