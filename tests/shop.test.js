import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, test } from 'vitest';
import { ShopScreen, SHOP_DEMO_SAVE, SCENES } from '../src/ui/ShopScreen.jsx';
import { ShopBay } from '../src/ui/shop/ShopBay.jsx';
import { CoinMark } from '../src/ui/components/icons.jsx';

const { createElement: h } = React;

describe('Silicon Gothic scrap exchange', () => {
  test('demo save and scenes cover the four racks', () => {
    expect(SHOP_DEMO_SAVE.scrap).toBeGreaterThan(100);
    expect(SHOP_DEMO_SAVE.owned).toContain('w_iron');
    expect(SCENES.probes.slot).toBe('weapon');
    expect(SCENES.suits.slot).toBe('armor');
    expect(SCENES.talismans.slot).toBe('tool');
    expect(SCENES.rations.slot).toBe('consumable');
  });

  test('CoinMark stays geometric', () => {
    let root;
    act(() => { root = TestRenderer.create(h(CoinMark, { size: 16 })); });
    expect(JSON.stringify(root.toJSON())).toContain('viewBox');
  });

  test('ShopBay comparison plate has no inline hex', () => {
    let root;
    act(() => {
      root = TestRenderer.create(h(ShopBay, {
        save: SHOP_DEMO_SAVE,
        go: () => {},
        onBuy: () => {},
        onEquip: () => {},
      }));
    });
    const json = root.toJSON();
    expect(json.props.className).toContain('sg-ui');
    expect(json.props['data-shop-status']).toBe('ready');
    const html = JSON.stringify(json);
    expect(html).toContain('SCRAP EXCHANGE');
    expect(html).toContain('Comparison plate');
    expect(html).toContain('Iron Probe');
    expect(html).toContain('Copper Probe');
    expect(html).not.toMatch(/style":\{[^}]*#[0-9a-fA-F]{3,8}/);
  });

  test('ShopScreen exposes data-shop-status', async () => {
    let root;
    await act(async () => {
      root = TestRenderer.create(h(ShopScreen, { go: () => {} }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    const json = root.toJSON();
    expect(json.props['data-shop-status']).toBe('ready');
    expect(json.props.className).toContain('sg-ui');
    const text = JSON.stringify(json);
    expect(text).toContain('SCRAP EXCHANGE');
    expect(text).toContain('PROBES');
    expect(text).toContain('Loadout');
  });
});
