import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, test } from 'vitest';
import {
  NotesScreen, NOTES_DEMO_SAVE, flattenNotes, MasteryDie,
} from '../src/ui/NotesScreen.jsx';
import { BookMark } from '../src/ui/components/icons.jsx';

const { createElement: h } = React;

describe('Silicon Gothic field notes / CODEX', () => {
  test('flattenNotes covers every lesson with a world', () => {
    const notes = flattenNotes();
    expect(notes.length).toBeGreaterThan(10);
    expect(notes.every(n => n.id && n.world && n.title)).toBe(true);
    expect(notes.some(n => n.id === 'L1a' && n.title === 'Why binary?')).toBe(true);
  });

  test('NOTES_DEMO_SAVE seeds recovered terminals for stills', () => {
    expect(NOTES_DEMO_SAVE.lessons.L1a).toBe(true);
    expect(NOTES_DEMO_SAVE.noteRecall.L1a).toEqual({
      attempts: 2, correct: 1, streak: 1,
    });
    expect(NOTES_DEMO_SAVE.skill.numbers.seen).toBeGreaterThan(0);
  });

  test('BookMark stays geometric (no lucide paths)', () => {
    let root;
    act(() => {
      root = TestRenderer.create(h(BookMark, { size: 16 }));
    });
    expect(JSON.stringify(root.toJSON())).toContain('viewBox');
  });

  test('MasteryDie exposes mastery die copy', () => {
    let root;
    act(() => {
      root = TestRenderer.create(h(MasteryDie, { save: NOTES_DEMO_SAVE }));
    });
    const text = JSON.stringify(root.toJSON());
    expect(text).toContain('mastery die');
    expect(text).toContain('Number Systems');
  });

  test('NotesScreen exposes data-notes-status and archive copy', async () => {
    let root;
    await act(async () => {
      root = TestRenderer.create(h(NotesScreen, {
        save: NOTES_DEMO_SAVE,
        go: () => {},
        onRecall: () => {},
      }));
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    const json = root.toJSON();
    expect(json.props['data-notes-status']).toBe('ready');
    expect(json.props.className).toContain('sg-ui');
    const text = JSON.stringify(json);
    expect(text).toContain('CODEX');
    expect(text).toContain('mastery die');
    expect(text).toContain('Why binary?');
    expect(text).toContain('1/2 recall');
    expect(text).toContain('Terminal rack');
    expect(text).toContain('Holo reader');
    expect(text).toContain('HOLO');
  });
});
