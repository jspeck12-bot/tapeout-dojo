import { describe, expect, test } from 'vitest';
import {
  conceptMastery,
  dueTopics,
  masteryLevel,
  reviewInit,
  reviewUpdate,
  todayNum,
} from '../src/game/recall.js';

describe('spaced recall scheduling', () => {
  test('grows intervals from one day to three days and then by ease', () => {
    const day = 20_000;
    const first = reviewUpdate(null, 1, day);
    const second = reviewUpdate(first, 1, day + 1);
    const third = reviewUpdate(second, 1, day + 4);

    expect(first).toMatchObject({ seen: 1, streak: 1, interval: 1, dueDay: day + 1 });
    expect(second).toMatchObject({ seen: 2, streak: 2, interval: 3, dueDay: day + 4 });
    expect(third.streak).toBe(3);
    expect(third.interval).toBeGreaterThan(3);
    expect(third.dueDay).toBe(day + 4 + third.interval);
  });

  test('a lapse records the miss and schedules a next-day retry', () => {
    const prior = { ...reviewInit(), seen: 4, streak: 4, interval: 18, ease: 2.5 };
    const next = reviewUpdate(prior, 0.2, 500);

    expect(next).toMatchObject({
      seen: 5,
      lapses: 1,
      streak: 0,
      interval: 1,
      dueDay: 501,
    });
    expect(next.ease).toBeCloseTo(2.3);
    expect(prior.streak).toBe(4);
  });

  test('clamps quality and ease to their supported ranges', () => {
    let record = { ...reviewInit(), ease: 2.79 };
    record = reviewUpdate(record, 99, 10);
    expect(record.lastQ).toBe(1);
    expect(record.ease).toBeLessThanOrEqual(2.8);

    record = { ...record, ease: 1.31 };
    record = reviewUpdate(record, -99, 11);
    expect(record.lastQ).toBe(0);
    expect(record.ease).toBeGreaterThanOrEqual(1.3);
  });

  test('returns only seen topics whose due day has arrived', () => {
    const skill = {
      due: { ...reviewInit(), seen: 1, dueDay: 50 },
      future: { ...reviewInit(), seen: 1, dueDay: 52 },
      untouched: reviewInit(),
    };

    expect(dueTopics(skill, 50)).toEqual(['due']);
    expect(dueTopics(null, 50)).toEqual([]);
  });

  test('maps practice depth to stable mastery levels and scores', () => {
    expect(masteryLevel(null)).toBe(0);
    expect(masteryLevel({ seen: 1, streak: 1, interval: 1 })).toBe(1);
    expect(masteryLevel({ seen: 2, streak: 2, interval: 3 })).toBe(2);
    expect(masteryLevel({ seen: 5, streak: 4, interval: 14 })).toBe(3);
    expect(conceptMastery({ seen: 5, streak: 5, interval: 21 })).toBe(1);
    expect(todayNum(86_400_000 * 123)).toBe(123);
  });
});
