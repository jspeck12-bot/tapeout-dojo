import { describe, expect, test } from 'vitest';
import { NOTE_RECALL, NOTE_WIDGET, noteMeta } from '../src/game/codex.js';
import { LESSONS, TOPIC_LIST } from '../src/game/content.js';

describe('interactive Codex contracts', () => {
  const lessons = Object.values(LESSONS).flat();

  test('provides one valid retrieval question for every canonical field note', () => {
    expect(Object.keys(NOTE_RECALL).sort()).toEqual(lessons.map((lesson) => lesson.id).sort());
    for (const lesson of lessons) {
      const meta = noteMeta(lesson.id);
      expect(meta.prompt.length).toBeGreaterThan(12);
      expect(meta.options.length).toBeGreaterThanOrEqual(3);
      expect(meta.correct).toBeGreaterThanOrEqual(0);
      expect(meta.correct).toBeLessThan(meta.options.length);
      expect(meta.hook.length).toBeGreaterThan(20);
    }
  });

  test('maps every note to a real mastery topic and live widget', () => {
    const topics = new Set(TOPIC_LIST.map((topic) => topic.id));
    const widgets = new Set(Object.values(NOTE_WIDGET));
    expect(widgets).toEqual(new Set(['number', 'gate', 'compiler', 'mux', 'wave', 'pipeline']));
    for (const lesson of lessons) {
      const meta = noteMeta(lesson.id);
      expect(topics.has(meta.topic)).toBe(true);
      expect(widgets.has(meta.widget)).toBe(true);
    }
  });

  test('keeps CHIP-1 retrieval in datapath integration rather than FSM recall', () => {
    expect(noteMeta('L7a').topic).toBe('integration');
    expect(noteMeta('L7b').topic).toBe('integration');
  });
});
