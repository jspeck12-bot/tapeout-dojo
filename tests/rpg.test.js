import { describe, expect, test } from 'vitest';
import {
  ITEM_BY_ID,
  derivedStats,
  enemyFor,
  levelFromXp,
  rpgFix,
} from '../src/game/rpg.js';

describe('RPG progression contracts', () => {
  test('advances levels exactly at cumulative XP boundaries', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(79)).toBe(1);
    expect(levelFromXp(80)).toBe(2);
    expect(levelFromXp(239)).toBe(2);
    expect(levelFromXp(240)).toBe(3);
  });

  test('derives combat stats from level and equipped gear', () => {
    const save = {
      xp: 240,
      gear: { weapon: 'w_kelvin', armor: 'a_mail', tool: 't_sink' },
    };
    const stats = derivedStats(save);

    expect(stats.lvl).toBe(3);
    expect(stats.maxHp).toBe(100 + 28 + ITEM_BY_ID.a_mail.hp);
    expect(stats.atk).toBe(20 + 8 + ITEM_BY_ID.w_kelvin.atk);
    expect(stats.defPct).toBe(0.3);
    expect(stats.lifesteal).toBe(8);
    expect(stats.timerMult).toBe(1.25);
  });

  test('generates deterministic enemies and applies boss/difficulty scaling', () => {
    const normal = enemyFor('c4', 4, 40, false, 'engineer', false);
    const repeat = enemyFor('c4', 4, 40, false, 'engineer', false);
    const boss = enemyFor('c4', 4, 40, true, 'architect', true);

    expect(repeat).toEqual(normal);
    expect(boss.boss).toBe(true);
    expect(boss.hp).toBeGreaterThan(normal.hp);
    expect(boss.atk).toBeGreaterThan(normal.atk);
    expect(boss.scrap).toBeGreaterThan(normal.scrap);
  });

  test('repairs malformed legacy RPG fields and clamps inventory', () => {
    const save = {
      xp: 100,
      gear: null,
      owned: null,
      inv: { potions: -1, flux: 50 },
      combat: { kills: 2.9, deaths: -1, flawless: '3' },
    };
    const repaired = rpgFix(save);

    expect(repaired).toBe(save);
    expect(repaired.gear).toEqual({ weapon: 'w_iron', armor: 'a_cloth', tool: null });
    expect(repaired.owned).toEqual(['w_iron', 'a_cloth']);
    expect(repaired.inv).toEqual({ potions: 0, flux: 5 });
    expect(repaired.combat).toEqual({ kills: 2, deaths: 0, flawless: 3 });
  });

  test('falls back safely when equipped item ids are unknown', () => {
    const stats = derivedStats({
      xp: 0,
      gear: { weapon: 'unknown', armor: 'unknown', tool: 'unknown' },
    });

    expect(stats.maxHp).toBe(100);
    expect(stats.atk).toBe(30);
    expect(stats.defPct).toBe(0);
    expect(stats.timerMult).toBe(1);
  });
});
