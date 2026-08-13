import { describe, expect, test } from 'vitest';
import { BOSS_SPECS, bossSpec, grantRemembrance } from '../src/game/bosses.js';
import { LESSONS } from '../src/game/content.js';
import { ITEM_BY_ID, enemyFor } from '../src/game/rpg.js';
import { challengesOf } from '../src/world/challenges.js';
import { dungeonModel } from '../src/world/dungeon.js';
import { mineModel } from '../src/world/mine.js';

describe('seven-boss encounter contract', () => {
  test('defines exactly one pedagogical boss and remembrance per world', () => {
    expect(Object.keys(BOSS_SPECS)).toEqual(['b6', 'g6', 'm6', 'c7', 's7', 'f3', 'chip1']);
    for (const [id, spec] of Object.entries(BOSS_SPECS)) {
      expect(spec.world).toBeGreaterThanOrEqual(1);
      expect(spec.world).toBeLessThanOrEqual(7);
      expect(spec.phases).toHaveLength(3);
      expect(spec.mechanic).toHaveLength(3);
      expect(ITEM_BY_ID[spec.reward]?.remembrance).toBe(true);
      expect(challengesOf(spec.world).find((challenge) => challenge.id === id)?.boss).toBeTruthy();
    }
  });

  test('attaches a reachable fog choice to every pure world model', () => {
    for (let world = 1; world <= 7; world++) {
      const lessonIds = (LESSONS[world] || []).map((lesson) => lesson.id);
      const model = world === 1
        ? mineModel(lessonIds)
        : dungeonModel(world, challengesOf(world), lessonIds);
      expect(model.fogGate.kind).toBe('fog');
      expect(model.fogGate.bossId).toBe(challengesOf(world).find((challenge) => challenge.boss).id);
      expect(model.fogGate.target).toEqual(model.interactables.find((item) => item.boss).target);
    }
  });

  test('uses canonical encounter names in combat enemies', () => {
    for (const [id, spec] of Object.entries(BOSS_SPECS)) {
      const enemy = enemyFor(id, spec.world, 50, true, 'engineer', false);
      expect(enemy.name).toBe(spec.name);
      expect(enemy.bossSpec).toBe(bossSpec(id));
    }
  });

  test('grants each remembrance once without auto-equipping it', () => {
    const save = {
      remembrances: {},
      owned: ['w_iron', 'a_cloth'],
      gear: { weapon: 'w_iron', armor: 'a_cloth', tool: null },
    };
    expect(grantRemembrance(save, 'b6')).toBe('r_overflow');
    expect(save.owned).toContain('r_overflow');
    expect(save.gear.weapon).toBe('w_iron');
    expect(grantRemembrance(save, 'b6')).toBeNull();
    expect(save.owned.filter((id) => id === 'r_overflow')).toHaveLength(1);
  });
});
