import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, test } from 'vitest';
import { WorldSelectScreen, DIE_PADS, enterTarget } from '../src/ui/WorldSelectScreen.jsx';
import { LockMark, DieMark } from '../src/ui/components/icons.jsx';

const { createElement: h } = React;

const save = {
  xp: 40,
  scrap: 3,
  skill: {},
  done: {},
  lessons: {},
  tapeoutDone: false,
  ngplus: false,
};

describe('Silicon Gothic world select', () => {
  test('die pads cover all seven worlds with irregular areas', () => {
    expect(DIE_PADS).toHaveLength(7);
    expect(DIE_PADS.map(p => p.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(DIE_PADS.map(p => p.area)).size).toBe(7);
  });

  test('enterTarget routes mines to mine and later worlds to dungeon', () => {
    expect(enterTarget(1)).toEqual({ name: 'mine' });
    expect(enterTarget(3)).toEqual({ name: 'dungeon', w: 3 });
    expect(enterTarget(7)).toEqual({ name: 'dungeon', w: 7 });
  });

  test('fab marks stay geometric (no lucide paths)', () => {
    let lock;
    let die;
    act(() => {
      lock = TestRenderer.create(h(LockMark, { size: 14 }));
      die = TestRenderer.create(h(DieMark, { size: 16 }));
    });
    expect(JSON.stringify(lock.toJSON())).toContain('viewBox');
    expect(JSON.stringify(die.toJSON())).toContain('viewBox');
  });

  test('WorldSelectScreen exposes data-worldselect-status and die pads', async () => {
    let root;
    await act(async () => {
      root = TestRenderer.create(h(WorldSelectScreen, { save, go: () => {} }));
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    const json = root.toJSON();
    expect(json.props['data-worldselect-status']).toBe('ready');
    expect(json.props.className).toContain('sg-ui');
    const text = JSON.stringify(json);
    expect(text).toContain('WORLD SELECT');
    expect(text).toContain('Die floorplan');
    expect(text).toContain('The Bit Mines');
    expect(text).toContain('DESCEND INTO THE MINES');
    expect(text).toContain('mines');
    expect(text).toContain('tapeout');
    // Locked pads beyond world 1 on a fresh save.
    expect(text).toContain('Module Foundry sealed');
    expect(text).toContain('"data-unlocked":"0"');
  });
});
