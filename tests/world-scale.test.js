import { describe, expect, test } from 'vitest';
import { LESSONS, WORLDS } from '../src/game/content.js';
import { challengesOf } from '../src/world/challenges.js';
import { dungeonModel } from '../src/world/dungeon.js';
import { mineModel } from '../src/world/mine.js';
import { WORLD_SCALE } from '../src/world/scale.js';

function modelOf(world) {
  const lessonIds = (LESSONS[world] || []).map((lesson) => lesson.id);
  return world === 1
    ? mineModel(lessonIds)
    : dungeonModel(world, challengesOf(world), lessonIds);
}

describe('expanded world scale', () => {
  test('expands every campaign world by an intentional world-specific factor', () => {
    expect(Object.keys(WORLD_SCALE).map(Number).sort((a, b) => a - b))
      .toEqual(WORLDS.map((world) => world.id));
    Object.values(WORLD_SCALE).forEach((factor) => {
      expect(factor).toBeGreaterThanOrEqual(1.25);
      expect(factor).toBeLessThanOrEqual(1.6);
    });
  });

  test('scales geometry, paths, stations, gates, and raster metadata together', () => {
    for (const world of WORLDS) {
      const model = modelOf(world.id);
      expect(model.worldScale).toBe(WORLD_SCALE[world.id]);
      expect(model.cellSize).toBe(2 * WORLD_SCALE[world.id]);
      expect(model.bounds.maxX - model.bounds.minX).toBeGreaterThan(40);
      expect(model.path.length).toBeGreaterThan(2);
      expect(model.interactables.filter((item) => item.ord).every((item) =>
        Number.isFinite(item.x) && Number.isFinite(item.z))).toBe(true);
      expect(model.gateCollider.maxX - model.gateCollider.minX).toBeGreaterThan(0);
    }
  });

  test('retains contiguous station order after expansion', () => {
    for (const world of WORLDS) {
      const stations = modelOf(world.id).interactables
        .filter((item) => item.ord)
        .sort((a, b) => a.ord - b.ord);
      expect(stations.map((station) => station.ord))
        .toEqual(Array.from({ length: stations.length }, (_, index) => index + 1));
      expect(stations.at(-1).boss).toBe(true);
    }
  });
});
